param([Parameter(Mandatory=$true)][string]$EasExecutable)
# Invoke from mobile/ so EAS selects this project. Readback only; unknown values
# remain captured and are never printed. Output path is anchored to this script.
$bolaPublicConfig = @{
 EXPO_PUBLIC_PRIVACY_POLICY_URL = 'https://maxwellabgit.github.io/privacy.html'
 EXPO_PUBLIC_TERMS_OF_SERVICE_URL = 'https://maxwellabgit.github.io/terms.html'
 EXPO_PUBLIC_SUPPORT_URL = 'https://maxwellabgit.github.io/support.html'
 EXPO_PUBLIC_DELETION_INFO_URL = 'https://maxwellabgit.github.io/deletion.html'
 EXPO_PUBLIC_APP_ADS_TXT_URL = 'https://maxwellabgit.github.io/app-ads.txt'
 EXPO_PUBLIC_ADMOB_IOS_APP_ID = 'ca-app-pub-4740685179017246~9596916235'
 EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID = 'ca-app-pub-4740685179017246/5830819203'
 EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID = 'ca-app-pub-4740685179017246/7882267470'
 EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID = 'ca-app-pub-4740685179017246/8045919001'
 EXPO_PUBLIC_SUPABASE_URL = 'https://jcrpxoojxixoieqqfgzo.supabase.co'
}
$bolaConfigProof = @{ status = 'PUBLIC_CONFIGURATION_READBACK_VERIFIED'; environments = @{} }
foreach ($bolaEnvironment in @('preview','production')) {
 $bolaEnvSnapshot = & node $EasExecutable env:list $bolaEnvironment --scope project --format short 2>$null
 if ($LASTEXITCODE -ne 0) { throw 'EAS public readback failed' }
 foreach ($bolaConfigName in $bolaPublicConfig.Keys) {
  if (-not ($bolaEnvSnapshot -contains ($bolaConfigName + '=' + $bolaPublicConfig[$bolaConfigName]))) { throw "Public readback mismatch: $bolaEnvironment / $bolaConfigName" }
 }
 if (-not ($bolaEnvSnapshot -contains 'EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_vbGJyOe6WC1ZdsmvftxLfg_hXHmWdC8')) { throw "Publishable project key mismatch: $bolaEnvironment" }
 $bolaConfigProof.environments[$bolaEnvironment] = @{
  public = $bolaPublicConfig
  supabaseKeyKind = 'publishable'
  revenueCatKeyEntryPresent = [bool]($bolaEnvSnapshot | Where-Object { $_.StartsWith('EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY=') })
  testDeviceEntryPresent = [bool]($bolaEnvSnapshot | Where-Object { $_.StartsWith('EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS=') })
  liveModeConfigured = [bool]($bolaEnvSnapshot -contains 'EXPO_PUBLIC_ADS_ENV=live')
 }
}
$bolaProofPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'C10_EAS_PRODUCTION_CONFIG_2026-10-03.json'
$bolaConfigProof | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $bolaProofPath -Encoding utf8
Write-Output 'Preview and production public configuration verified; sanitized proof saved.'
