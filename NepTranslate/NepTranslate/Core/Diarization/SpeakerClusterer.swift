import Foundation

/// Online speaker clustering using cosine similarity.
///
/// Each speech segment's embedding is compared against known cluster centroids.
/// If close enough to an existing cluster, it's assigned that speaker ID.
/// Otherwise a new speaker cluster is created. IDs are stable within a session.
final class SpeakerClusterer {

    /// Cosine similarity threshold. Above this → same speaker.
    var similarityThreshold: Float = 0.75

    /// Known speaker clusters: label → centroid embedding.
    private var clusters: [String: [Float]] = [:]
    private var nextSpeakerIndex = 1

    var speakerCount: Int { clusters.count }

    // MARK: - Assignment

    /// Assign a speaker label to an embedding vector.
    /// - Returns: A label like "speaker1", "speaker2", etc.
    func assignSpeaker(embedding: [Float]) -> String {
        var bestSpeaker: String?
        var bestSimilarity: Float = -1

        for (label, centroid) in clusters {
            let sim = cosineSimilarity(embedding, centroid)
            if sim > bestSimilarity {
                bestSimilarity = sim
                bestSpeaker = label
            }
        }

        if let speaker = bestSpeaker, bestSimilarity >= similarityThreshold {
            // Update centroid with running average
            clusters[speaker] = average(clusters[speaker]!, embedding)
            return speaker
        } else {
            // New speaker
            let label = "speaker\(nextSpeakerIndex)"
            nextSpeakerIndex += 1
            clusters[label] = embedding
            return label
        }
    }

    /// Clear all clusters. Call when starting a new session.
    func reset() {
        clusters.removeAll()
        nextSpeakerIndex = 1
    }

    // MARK: - Vector Math

    private func cosineSimilarity(_ a: [Float], _ b: [Float]) -> Float {
        guard a.count == b.count, !a.isEmpty else { return 0 }

        var dot: Float = 0
        var normA: Float = 0
        var normB: Float = 0

        for i in 0..<a.count {
            dot += a[i] * b[i]
            normA += a[i] * a[i]
            normB += b[i] * b[i]
        }

        let denom = sqrtf(normA) * sqrtf(normB)
        return denom > 0 ? dot / denom : 0
    }

    private func average(_ a: [Float], _ b: [Float]) -> [Float] {
        zip(a, b).map { ($0 + $1) / 2.0 }
    }
}
