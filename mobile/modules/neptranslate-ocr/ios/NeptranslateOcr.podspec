Pod::Spec.new do |s|
  s.name           = 'NeptranslateOcr'
  s.version        = '1.0.0'
  s.summary        = 'On-device Latin and Devanagari OCR'
  s.homepage       = 'https://github.com/maxwellabgit/nepaliTranslation'
  s.license        = 'MIT'
  s.author         = 'NepTranslate'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => 'https://github.com/maxwellabgit/nepaliTranslation.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  # Both script pods must share GoogleUtilities 8 with Google Mobile Ads.
  # TextRecognition 7.x beside Devanagari 6.x cannot resolve (MLKitCommon / GoogleUtilities clash).
  s.dependency 'GoogleMLKit/TextRecognition', '~> 8.0'
  s.dependency 'GoogleMLKit/TextRecognitionDevanagari', '~> 8.0'
  s.source_files = '**/*.{h,m,mm,swift}'
end
