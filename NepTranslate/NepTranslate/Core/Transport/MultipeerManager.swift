import MultipeerConnectivity
import Combine
import UIKit

/// Manages Multipeer Connectivity between hub and remote phones.
///
/// In Conversation Mode:
///   - Hub advertises, remote browses and connects.
///   - Remote streams raw PCM audio bytes to hub via unreliable send.
///   - Hub sends translated text back via reliable send.
///
/// This is the MVP transport layer. When smart glasses replace the remote phone,
/// this class is swapped for a Bluetooth audio manager — the rest of the pipeline
/// stays identical because AudioEngine abstracts the input source.
final class MultipeerManager: NSObject, ObservableObject {

    // MARK: - Types

    enum Role {
        case hub    // Runs all inference, receives remote audio
        case remote // Streams mic audio, displays received translations
    }

    // MARK: - Properties

    private let serviceType = "nep-translate"
    private let myPeerID: MCPeerID
    private var session: MCSession
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser: MCNearbyServiceBrowser?

    @Published var connectedPeers: [MCPeerID] = []
    @Published var connectionStatus: ConnectionStatus = .disconnected

    var role: Role = .hub

    /// Hub receives audio data from remote.
    var onAudioReceived: ((Data) -> Void)?

    /// Remote receives translated text from hub.
    var onTranslationReceived: ((String) -> Void)?

    // MARK: - Init

    override init() {
        myPeerID = MCPeerID(displayName: UIDevice.current.name)
        session = MCSession(peer: myPeerID, securityIdentity: nil, encryptionPreference: .required)
        super.init()
        session.delegate = self
    }

    // MARK: - Connection

    /// Start as hub (advertise and wait for remote to connect).
    func startAsHub() {
        role = .hub
        advertiser = MCNearbyServiceAdvertiser(
            peer: myPeerID,
            discoveryInfo: ["role": "hub"],
            serviceType: serviceType
        )
        advertiser?.delegate = self
        advertiser?.startAdvertisingPeer()
        connectionStatus = .searching
    }

    /// Start as remote (browse for hub and connect).
    func startAsRemote() {
        role = .remote
        browser = MCNearbyServiceBrowser(peer: myPeerID, serviceType: serviceType)
        browser?.delegate = self
        browser?.startBrowsingForPeers()
        connectionStatus = .searching
    }

    /// Disconnect and stop all services.
    func stop() {
        advertiser?.stopAdvertisingPeer()
        browser?.stopBrowsingForPeers()
        session.disconnect()
        advertiser = nil
        browser = nil
        DispatchQueue.main.async {
            self.connectionStatus = .disconnected
            self.connectedPeers = []
        }
    }

    // MARK: - Data Transfer

    /// Send raw audio bytes to the hub (called by remote).
    /// Uses unreliable mode for lower latency — dropped packets are acceptable for audio.
    func sendAudio(data: Data) {
        guard !session.connectedPeers.isEmpty else { return }
        try? session.send(data, toPeers: session.connectedPeers, with: .unreliable)
    }

    /// Send translated text back to the remote (called by hub).
    /// Uses reliable mode — we don't want to drop translation results.
    func sendTranslation(text: String) {
        guard let data = text.data(using: .utf8),
              !session.connectedPeers.isEmpty else { return }
        try? session.send(data, toPeers: session.connectedPeers, with: .reliable)
    }
}

// MARK: - MCSessionDelegate

extension MultipeerManager: MCSessionDelegate {

    func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        DispatchQueue.main.async {
            self.connectedPeers = session.connectedPeers
            switch state {
            case .connected:
                self.connectionStatus = .connected
            case .notConnected:
                self.connectionStatus = session.connectedPeers.isEmpty ? .disconnected : .connected
            case .connecting:
                self.connectionStatus = .searching
            @unknown default:
                break
            }
        }
    }

    func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        if role == .hub {
            onAudioReceived?(data)
        } else {
            if let text = String(data: data, encoding: .utf8) {
                onTranslationReceived?(text)
            }
        }
    }

    // Unused but required by protocol
    func session(_ session: MCSession, didReceive stream: InputStream, withName: String, fromPeer: MCPeerID) {}
    func session(_ session: MCSession, didStartReceivingResourceWithName: String, fromPeer: MCPeerID, with: Progress) {}
    func session(_ session: MCSession, didFinishReceivingResourceWithName: String, fromPeer: MCPeerID, at: URL?, withError: Error?) {}
}

// MARK: - MCNearbyServiceAdvertiserDelegate

extension MultipeerManager: MCNearbyServiceAdvertiserDelegate {

    func advertiser(
        _ advertiser: MCNearbyServiceAdvertiser,
        didReceiveInvitationFromPeer peerID: MCPeerID,
        withContext context: Data?,
        invitationHandler: @escaping (Bool, MCSession?) -> Void
    ) {
        // Auto-accept incoming connections
        invitationHandler(true, session)
    }
}

// MARK: - MCNearbyServiceBrowserDelegate

extension MultipeerManager: MCNearbyServiceBrowserDelegate {

    func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        // Auto-invite any hub we find
        if info?["role"] == "hub" {
            browser.invitePeer(peerID, to: session, withContext: nil, timeout: 10)
        }
    }

    func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {}
}
