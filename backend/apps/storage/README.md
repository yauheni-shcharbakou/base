## Bunny Storage configuration

#### Storage > FTP & API access
`Password` => env `BUNNY_STORAGE_API_KEY`

#### CDN > General > Origin
`Storage zone` => env `BUNNY_STORAGE_CDN_ZONE`

#### CDN > Security > General
- [x] `Block root path access`
- [x] `Block POST requests`

#### CDN > Security > Token authentication
- [x] `Token authentication`
- [ ] `Token IP validation` (enable for `prod` storage cdn)

`Url token authentication Key` => env `BUNNY_STORAGE_CDN_PRIVATE_KEY`

#### CDN > Headers
- [x] `Add CORS headers`

`Extension List`: `eot, ttf, woff, woff2, css, js, jpg, jpeg, png, webp, gif, mp3, mp4, mpeg, svg, webm, pdf`

## Bunny Stream configuration

#### Stream > Encoding
- [x] `Keep original files`
- [x] `MP4 fallback`
- [ ] `Content tagging`

#### Stream > Security > General
- [ ] `Enable direct play`
- [x] `Block direct url file access`
- [x] `Embed view token authentication`
- [x] `CDN token authentication`

`Allowed domains`: set list

`Token authentication key` => env `BUNNY_STREAM_CDN_PRIVATE_KEY`

#### Stream > API
`Video library ID` => env `BUNNY_STREAM_LIBRARY_ID`

`Pull zone` => env `BUNNY_STREAM_CDN_ZONE`

`API key` => env `BUNNY_STREAM_API_KEY`

#### CDN > Security > General (stream-related CDN)
- [x] `Block root path access`
- [x] `Block POST requests`
- [x] `Block direct url file access`

`Allowed referrers`: set list (same as `Allowed domains` in stream)

#### CDN > Security > Token authentication (stream-related CDN)
- [x] `Token authentication`
- [ ] `Token IP validation`

`Url token authentication Key` => env `BUNNY_STREAM_CDN_PRIVATE_KEY`

#### CDN > Headers
- [x] `Add CORS headers`

`Extension List`: `*`
