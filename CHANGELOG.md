# Changelog

## [0.5.0](https://github.com/trybun/trybun/compare/v0.4.0...v0.5.0) (2026-11-14)


### Added

* add attachments (S1-08) ([#244](https://github.com/trybun/trybun/issues/244)) ([05c15ea](https://github.com/trybun/trybun/commit/05c15eaa37fd6bcc956ba206ec2220b10c18ed48))
* add comments and internal notes (S1-12) ([#260](https://github.com/trybun/trybun/issues/260)) ([43c1ad9](https://github.com/trybun/trybun/commit/43c1ad994a1a4b71a4ce2393287584f921486886))
* add the team list view (S1-13) ([#270](https://github.com/trybun/trybun/issues/270)) ([90c27c4](https://github.com/trybun/trybun/commit/90c27c4022b664e63a43815aed8081f80353d706))
* add ticket visibility and sharing requests (S1-11) ([#257](https://github.com/trybun/trybun/issues/257)) ([6c5d925](https://github.com/trybun/trybun/commit/6c5d92513e3cc8a734794247930c0809b828987d))
* **deploy:** back up and restore the attachment storage (S1-08) ([#247](https://github.com/trybun/trybun/issues/247)) ([b46c5f4](https://github.com/trybun/trybun/commit/b46c5f4c1c123fb3e9e696a4c10c507ec62cbad7))
* **deploy:** refuse an impossible restore before it asks and before Trybun stops ([#248](https://github.com/trybun/trybun/issues/248)) ([#255](https://github.com/trybun/trybun/issues/255)) ([d6d85a2](https://github.com/trybun/trybun/commit/d6d85a2bba4b3664359fcfb0a960ceb258bed040))
* **server:** implement the permission layer (S1-04) ([#225](https://github.com/trybun/trybun/issues/225)) ([21c748c](https://github.com/trybun/trybun/commit/21c748c0d07c8bfc4767fe8747add6b5bb00d8a7))
* **server:** implement the ticket model (S1-05) ([#226](https://github.com/trybun/trybun/issues/226)) ([99975f0](https://github.com/trybun/trybun/commit/99975f0289fcad6dc1242b859cbc94c78b068a4d))
* **server:** implement ticket statuses and resolution confirmation (S1-06) ([#231](https://github.com/trybun/trybun/issues/231)) ([8152ff0](https://github.com/trybun/trybun/commit/8152ff045d439d393d78c8756fd1dc438eb5a729))
* **server:** search and look up projects, organizations and people for the ticket filters ([#284](https://github.com/trybun/trybun/issues/284)) ([1e20e15](https://github.com/trybun/trybun/commit/1e20e157703966e2ab64776a24233124c2a5ceef))
* **ui:** add a popup search input and checkbox items to Combobox ([#285](https://github.com/trybun/trybun/issues/285)) ([1bcaaaa](https://github.com/trybun/trybun/commit/1bcaaaac6bf69c87ce9a28d8fae8eeb65c354fcb))
* **ui:** add the GFM editor and the shared Markdown pipeline (S1-07) ([#234](https://github.com/trybun/trybun/issues/234)) ([153a215](https://github.com/trybun/trybun/commit/153a215e1a2bd5001f6bc3b6983f3c617176723b))
* **ui:** open attachment images in a new tab ([#246](https://github.com/trybun/trybun/issues/246)) ([#253](https://github.com/trybun/trybun/issues/253)) ([5a1fc2a](https://github.com/trybun/trybun/commit/5a1fc2a593ec8114cba64faec58980471ee3ed30))
* **web:** add the end-user portal (S1-09) ([#240](https://github.com/trybun/trybun/issues/240)) ([9ee9b0e](https://github.com/trybun/trybun/commit/9ee9b0e31cdd4ae80822d6f646a2a703b08f01ef))
* **web:** add the team ticket view and full form (S1-10) ([#256](https://github.com/trybun/trybun/issues/256)) ([5195c83](https://github.com/trybun/trybun/commit/5195c833e5093df54da2dc684e0261ec9d37833e))
* **web:** load every option of the ticket list filters ([#276](https://github.com/trybun/trybun/issues/276)) ([faef288](https://github.com/trybun/trybun/commit/faef288b2e65dfe2f2a5667fc737809b09b948b5))
* **web:** one searchable picker per ticket list filter ([#290](https://github.com/trybun/trybun/issues/290)) ([64f2ec1](https://github.com/trybun/trybun/commit/64f2ec17fc533e6f1453e3e1d0a936a857be35cf))
* **web:** show the ticket type on phone cards and in the tablet table ([#294](https://github.com/trybun/trybun/issues/294)) ([67b042c](https://github.com/trybun/trybun/commit/67b042c630c2d6fcd30264741d8ebdd2f8c49b9f))


### Fixed

* **deploy:** stop the daily backup at its first failing step ([#249](https://github.com/trybun/trybun/issues/249)) ([#250](https://github.com/trybun/trybun/issues/250)) ([3fb894c](https://github.com/trybun/trybun/commit/3fb894c106ed19c5e79329d9113a4e9700f9da41))
* **deps:** bump @hookform/resolvers from 6.0.0 to 7.0.1 ([#266](https://github.com/trybun/trybun/issues/266)) ([46673c1](https://github.com/trybun/trybun/commit/46673c1c9c6f595c3be3f2d6e4321b19765e1412))
* **deps:** bump caddy from 2.11.7-alpine to 2.11.7-alpine ([#264](https://github.com/trybun/trybun/issues/264)) ([e68cd78](https://github.com/trybun/trybun/commit/e68cd786d507068e95aac87b798fb0a8f13e3b5b))
* **deps:** bump chrislusf/seaweedfs from 4.51 to 4.52 in the docker-compose group ([#281](https://github.com/trybun/trybun/issues/281)) ([99a2a95](https://github.com/trybun/trybun/commit/99a2a95a544f36274ff636866d227c6229932f30))
* **deps:** bump fast-uri from 3.1.8 to 3.1.9 ([#223](https://github.com/trybun/trybun/issues/223)) ([bd019e1](https://github.com/trybun/trybun/commit/bd019e1533197cda6bc75f56a5e724224accf85c))
* **deps:** bump Node.js to 24.22.1 in the images, CI and local development ([#261](https://github.com/trybun/trybun/issues/261)) ([ac31e07](https://github.com/trybun/trybun/commit/ac31e07b75c5888680dbf8d8f52c9b9aed503c18))
* **deps:** bump pgvector/pgvector from `9d9c930` to `5895949` in /docker/postgres ([#262](https://github.com/trybun/trybun/issues/262)) ([a044171](https://github.com/trybun/trybun/commit/a044171ca89c730b7dd3013617263d5d8338ad78))
* **deps:** bump pgvector/pgvector in /docker/postgres ([a044171](https://github.com/trybun/trybun/commit/a044171ca89c730b7dd3013617263d5d8338ad78))
* **deps:** bump qs from 6.16.0 to 6.17.1 ([#235](https://github.com/trybun/trybun/issues/235)) ([233386e](https://github.com/trybun/trybun/commit/233386e9d6ca2ba7720893fd060bf53b7d41cf9f))
* **deps:** bump the docker-compose group with 4 updates ([#263](https://github.com/trybun/trybun/issues/263)) ([6596ae3](https://github.com/trybun/trybun/commit/6596ae35351488244ab19d78ce88c60e094cba06))
* **deps:** bump the npm group across 1 directory with 14 updates ([#298](https://github.com/trybun/trybun/issues/298)) ([ea4b34e](https://github.com/trybun/trybun/commit/ea4b34e086323dc183bb67faa0f06a60b8b69c1b))
* **deps:** bump the npm group across 1 directory with 39 updates ([#271](https://github.com/trybun/trybun/issues/271)) ([aaa92c0](https://github.com/trybun/trybun/commit/aaa92c07b726de7914e1848d722fe91c4a3cd7cf))
* **deps:** close the minimatch, glob and deepmerge advisories ([#324](https://github.com/trybun/trybun/issues/324)) ([#325](https://github.com/trybun/trybun/issues/325)) ([4c6b380](https://github.com/trybun/trybun/commit/4c6b38099b5e574bdf9276ecb66b99be331a255e))
* **deps:** upgrade CASL to 7.1 with a tag-only subject resolver ([#277](https://github.com/trybun/trybun/issues/277)) ([5b64aef](https://github.com/trybun/trybun/commit/5b64aef28e360f2130d0689cc21fc0ea38536415)), closes [#273](https://github.com/trybun/trybun/issues/273)
* **server:** lock the organization of a new ticket's snapshot (S1-05) ([#228](https://github.com/trybun/trybun/issues/228)) ([6ff9b47](https://github.com/trybun/trybun/commit/6ff9b477baba527a450efeb4db47eb6b4ddad8a1))
* **server:** plan an end user's record access in milliseconds, not 250 ms ([#321](https://github.com/trybun/trybun/issues/321)) ([#323](https://github.com/trybun/trybun/issues/323)) ([c5db203](https://github.com/trybun/trybun/commit/c5db203272a3e31e8f7f7491f33a14b74c3d278f))
* **server:** re-check the reason of the unassignment under a lock in every batch ([#229](https://github.com/trybun/trybun/issues/229)) ([#230](https://github.com/trybun/trybun/issues/230)) ([8e8675c](https://github.com/trybun/trybun/commit/8e8675c21085a8816b20374b3281fbbe8c209524))
* **ui:** keep the empty Combobox message in the accessibility tree ([#287](https://github.com/trybun/trybun/issues/287)) ([#302](https://github.com/trybun/trybun/issues/302)) ([7392c8d](https://github.com/trybun/trybun/commit/7392c8d7a5655c03ef5804867994ea189d9bcd72))
* **ui:** show tooltips on the Attach files and More formatting buttons ([#245](https://github.com/trybun/trybun/issues/245)) ([#251](https://github.com/trybun/trybun/issues/251)) ([e351f84](https://github.com/trybun/trybun/commit/e351f84a377d8a8edfc2221c1e63a1ccc0a83b52))
* **web:** allow the dev overlay's style elements under next dev ([#317](https://github.com/trybun/trybun/issues/317)) ([95fdb93](https://github.com/trybun/trybun/commit/95fdb9301efcad56680a415db4c6516c29294ffd))
* **web:** fit the ticket table in every language and check it per locale ([#295](https://github.com/trybun/trybun/issues/295)) ([#299](https://github.com/trybun/trybun/issues/299)) ([01f988c](https://github.com/trybun/trybun/commit/01f988cd63f085781ba5da2d5661ac86a4ad49e9))
* **web:** keep the lazy dialog buttons in place while the page hydrates ([#308](https://github.com/trybun/trybun/issues/308)) ([#309](https://github.com/trybun/trybun/issues/309)) ([993d354](https://github.com/trybun/trybun/commit/993d354b1c759066bf3f2ce2f597a4ea2821e149))
* **web:** keep the sharing actions inside the title cell on tablets ([#296](https://github.com/trybun/trybun/issues/296)) ([#297](https://github.com/trybun/trybun/issues/297)) ([fd85289](https://github.com/trybun/trybun/commit/fd85289cccff493b0dbd79ae5ff16aaea7be6365))
* **web:** tell the person when a ticket list filter reaches 50 values ([#314](https://github.com/trybun/trybun/issues/314)) ([cb7b0e0](https://github.com/trybun/trybun/commit/cb7b0e09f72ba5c106f99138f33a8b1a4b9d8d7c))

## [0.4.0](https://github.com/trybun/trybun/compare/v0.3.0...v0.4.0) (2026-11-03)


### Added

* **web:** collapse the side navigation to icons on desktop ([#215](https://github.com/trybun/trybun/issues/215)) ([#219](https://github.com/trybun/trybun/issues/219)) ([52a1264](https://github.com/trybun/trybun/commit/52a1264efb8856ecbcd88150b4dfc812c13cd766))
* **web:** full-width lists, readable-width forms in the app shell ([#179](https://github.com/trybun/trybun/issues/179)) ([#194](https://github.com/trybun/trybun/issues/194)) ([36e6d8f](https://github.com/trybun/trybun/commit/36e6d8f7c54feac4e85040c303a5dba1dde969c1))
* **web:** show item names as tooltips on the collapsed side navigation ([#217](https://github.com/trybun/trybun/issues/217)) ([#221](https://github.com/trybun/trybun/issues/221)) ([3826eb1](https://github.com/trybun/trybun/commit/3826eb1ad401025af0d1ab288ae2b06d86f9981f))


### Fixed

* **deps:** bump postgres to 18.6-alpine3.24 in /docker/backup ([#197](https://github.com/trybun/trybun/issues/197)) ([1e00165](https://github.com/trybun/trybun/commit/1e0016568eaf00af70e8eaec48e942be8846820d))
* **deps:** bump the docker-compose group with 2 updates ([#198](https://github.com/trybun/trybun/issues/198)) ([9e1af41](https://github.com/trybun/trybun/commit/9e1af41bd3c5eeb625ffacdd6c760da8a56c3cd8))
* **deps:** bump the npm group with 24 updates ([#201](https://github.com/trybun/trybun/issues/201)) ([451204c](https://github.com/trybun/trybun/commit/451204c38cea66536325676523a1a5a31c607332))
* **deps:** update keycloak/keycloak 26.8.1 to the rebuilt image digest ([#199](https://github.com/trybun/trybun/issues/199)) ([c4f101f](https://github.com/trybun/trybun/commit/c4f101fa024d052b26a68c159dc11e5c82d0722a))
* **ui:** blue 2 px focus ring that never looks like an error ([#177](https://github.com/trybun/trybun/issues/177)) ([#182](https://github.com/trybun/trybun/issues/182)) ([e54f64b](https://github.com/trybun/trybun/commit/e54f64bea142583545f12ddb4592e664091932a9))
* **ui:** keep the focus ring of the tour sheet actions visible on phones ([#190](https://github.com/trybun/trybun/issues/190)) ([#195](https://github.com/trybun/trybun/issues/195)) ([38040e2](https://github.com/trybun/trybun/commit/38040e2892191a4a931fb01ec0d0b2d6a80fd4b5))
* **ui:** move the product tour tip to the target of each step ([#188](https://github.com/trybun/trybun/issues/188)) ([#189](https://github.com/trybun/trybun/issues/189)) ([7fabab2](https://github.com/trybun/trybun/commit/7fabab2971dc4258ab7683f72f5ca23468598eb5))
* **ui:** show the product tour ring on button targets ([#186](https://github.com/trybun/trybun/issues/186)) ([#187](https://github.com/trybun/trybun/issues/187)) ([86dfe4a](https://github.com/trybun/trybun/commit/86dfe4a454032b525844033af48e0082b2de765f))
* **ui:** show toasts at the top on phones so they never cover a bottom sheet ([#207](https://github.com/trybun/trybun/issues/207)) ([#212](https://github.com/trybun/trybun/issues/212)) ([fed6036](https://github.com/trybun/trybun/commit/fed603695f2e106b024f198c3aca403b321c6a83))
* **web:** balance the header help icon with the account avatar ([#178](https://github.com/trybun/trybun/issues/178)) ([#192](https://github.com/trybun/trybun/issues/192)) ([f94e4ef](https://github.com/trybun/trybun/commit/f94e4ef1692982de8fe701601b3481cfe4173ca3))
* **web:** keep the help button on the first opening of the help menu ([#184](https://github.com/trybun/trybun/issues/184)) ([#185](https://github.com/trybun/trybun/issues/185)) ([817f015](https://github.com/trybun/trybun/commit/817f01587ed913fad43f3612b93f3c0610210457))
* **web:** keep the success message of the first-run wizard ([#176](https://github.com/trybun/trybun/issues/176)) ([#180](https://github.com/trybun/trybun/issues/180)) ([7494f48](https://github.com/trybun/trybun/commit/7494f482f3057e640e9088f0faf64683a0a72a5c))
* **web:** keep the tour ring inside the viewport after scrolling to the target ([#191](https://github.com/trybun/trybun/issues/191)) ([#208](https://github.com/trybun/trybun/issues/208)) ([939b5e6](https://github.com/trybun/trybun/commit/939b5e685470cf16a072edc2903b0928323f2337))
* **web:** keep the tour ring visible at the screen edge on phones ([#196](https://github.com/trybun/trybun/issues/196)) ([#202](https://github.com/trybun/trybun/issues/202)) ([4d46534](https://github.com/trybun/trybun/commit/4d46534589e979e84692260389497662db5ccd21))
* **web:** open the phone tour sheet away from the target it scrolls to ([#209](https://github.com/trybun/trybun/issues/209)) ([#213](https://github.com/trybun/trybun/issues/213)) ([c1e5b7a](https://github.com/trybun/trybun/commit/c1e5b7ae83f08d31e14e5840ab8dc49ee719c8e6))

## [0.3.0](https://github.com/trybun/trybun/compare/v0.2.1...v0.3.0) (2026-11-01)


### Added

* add invitations, account deactivation and user settings (S1-03) ([#160](https://github.com/trybun/trybun/issues/160)) ([4f77067](https://github.com/trybun/trybun/commit/4f770672aeb627836e8fdfa36f0dd76bf2045dc9))
* add organizations, e-mail domains and membership (S1-02) ([#149](https://github.com/trybun/trybun/issues/149)) ([9aac4cb](https://github.com/trybun/trybun/commit/9aac4cbc6758cb9ddde6c58d9fc7a855e2ae4999))
* add projects, project membership and archiving (S1-01) ([#134](https://github.com/trybun/trybun/issues/134)) ([2b99739](https://github.com/trybun/trybun/commit/2b99739e2254165111cceb84d9eefe6d6eeacf8e))
* share the overflow fade and name empty required fields ([#167](https://github.com/trybun/trybun/issues/167)) ([#171](https://github.com/trybun/trybun/issues/171)) ([669ea6f](https://github.com/trybun/trybun/commit/669ea6f06617df87e3421fd71e0ad49841b9a7a6))


### Fixed

* **agents:** ignore the links of the installed om-* skills ([#144](https://github.com/trybun/trybun/issues/144)) ([ee658d1](https://github.com/trybun/trybun/commit/ee658d182de76237cbc963796d3373adb5299861))
* **agents:** keep .ai/skills for project skills and extensions of om-* skills ([#155](https://github.com/trybun/trybun/issues/155)) ([e15f54c](https://github.com/trybun/trybun/commit/e15f54c17ac1cbf7a54c26bdc49081d53d8072d1))
* **agents:** run the test environment as its own Compose project ([#150](https://github.com/trybun/trybun/issues/150)) ([d2969ee](https://github.com/trybun/trybun/commit/d2969ee0df0397f1de38d00f07ec438aa37d6ac9))
* **deploy:** run the local environment as its own Compose project ([#154](https://github.com/trybun/trybun/issues/154)) ([ac943f5](https://github.com/trybun/trybun/commit/ac943f5d064a56175ccab455e504d79546414a33))
* **deploy:** upgrade brotli-libs in the backup image (CVE-2026-111497) ([#170](https://github.com/trybun/trybun/issues/170)) ([15c6674](https://github.com/trybun/trybun/commit/15c6674c0266b36b9d3e6ad8bc323dcc0ac5b9d3)), closes [#164](https://github.com/trybun/trybun/issues/164)
* **deps:** bump @hookform/resolvers from 5.9.2 to 6.0.0 ([#106](https://github.com/trybun/trybun/issues/106)) ([8d94b47](https://github.com/trybun/trybun/commit/8d94b477812fa37a84c21970a6b74107363a238d))
* **deps:** bump the npm group with 10 updates ([#105](https://github.com/trybun/trybun/issues/105)) ([065e839](https://github.com/trybun/trybun/commit/065e839acedd45251ec1a29a363f679a1c7b7581))
* **deps:** update systeminformation to 5.33.16 (GHSA-3f7j-7jwc-fxfj) ([#159](https://github.com/trybun/trybun/issues/159)) ([71cd43f](https://github.com/trybun/trybun/commit/71cd43f78d10cad0e61dd53fd8f9cfab72dcc26a))
* polish the invitations, accounts and settings UI ([#161](https://github.com/trybun/trybun/issues/161)) ([#166](https://github.com/trybun/trybun/issues/166)) ([9132fba](https://github.com/trybun/trybun/commit/9132fba59e42d51d8c4ec31f0103120c0eeebb29))
* **ui:** keep dialog titles within a phone and outline buttons readable on coloured surfaces ([#151](https://github.com/trybun/trybun/issues/151)) ([aa5fd44](https://github.com/trybun/trybun/commit/aa5fd44e3d24c1834947824f128219c567e450b9))
* **ui:** show toasts above dialogs and bottom sheets ([#172](https://github.com/trybun/trybun/issues/172)) ([#174](https://github.com/trybun/trybun/issues/174)) ([3e2dda9](https://github.com/trybun/trybun/commit/3e2dda95381f9da5cc0cba56e8b4dda37497bab8))
* **web:** mount the toast region only in the project views ([#136](https://github.com/trybun/trybun/issues/136)) ([a8468d1](https://github.com/trybun/trybun/commit/a8468d16e3029897d08664320609cb6b1d6ec5d8))
* **web:** return to the opened page after the sign-in ([#138](https://github.com/trybun/trybun/issues/138)) ([#141](https://github.com/trybun/trybun/issues/141)) ([b81215d](https://github.com/trybun/trybun/commit/b81215d7f6109ca2d451a72f8d78c9e3372af008))
* **web:** show the Trybun header on the first-run wizard ([#168](https://github.com/trybun/trybun/issues/168)) ([#175](https://github.com/trybun/trybun/issues/175)) ([0f3d9f8](https://github.com/trybun/trybun/commit/0f3d9f82b21dcbd6c31fe5a8b817891cdc4c5d4e))

## [0.2.1](https://github.com/trybun/trybun/compare/v0.2.0...v0.2.1) (2026-10-26)


### Fixed

* **deploy:** release the backup lock after the daily backup ([#103](https://github.com/trybun/trybun/issues/103)) ([3396743](https://github.com/trybun/trybun/commit/3396743378eda2ef10110b0a95c917fd21338f41))

## [0.2.0](https://github.com/trybun/trybun/compare/v0.1.2...v0.2.0) (2026-10-25)


### Added

* **deploy:** add the uninstall command of the deployment package ([#102](https://github.com/trybun/trybun/issues/102)) ([c0297cf](https://github.com/trybun/trybun/commit/c0297cfe3d63b4a8fbee33e153e890e8e1a206f7))


### Fixed

* **deploy:** stop the installation when data of an earlier one exists ([#99](https://github.com/trybun/trybun/issues/99)) ([836f73d](https://github.com/trybun/trybun/commit/836f73d7d9a0c559d20489184e719829e6f1729f))

## [0.1.2](https://github.com/trybun/trybun/compare/v0.1.1...v0.1.2) (2026-10-25)


### Fixed

* **server:** start the setup-token command with the logging module ([#96](https://github.com/trybun/trybun/issues/96)) ([9930a58](https://github.com/trybun/trybun/commit/9930a58a7d0a832c4896abaaa5b2a3adc52d78f3))

## [0.1.1](https://github.com/trybun/trybun/compare/v0.1.0...v0.1.1) (2026-10-25)


### Fixed

* **ci:** run the release jobs after a skipped job before prepare ([#94](https://github.com/trybun/trybun/issues/94)) ([00cec3d](https://github.com/trybun/trybun/commit/00cec3d26a628a8ae738071b5608b56206027b92))

## 0.1.0 (2026-10-25)


### Added

* add error handling and the observability baseline (S0-17) ([#65](https://github.com/trybun/trybun/issues/65)) ([1febc86](https://github.com/trybun/trybun/commit/1febc8664a3cbcfc2738dce76f9e37a2c1e5b158))
* add the application shell, the BFF proxy and the E2E set-up (S0-08) ([#66](https://github.com/trybun/trybun/issues/66)) ([3b3f2a2](https://github.com/trybun/trybun/commit/3b3f2a26b74875ce620c8f863d87afd65d2f3bea))
* add the install script, the first-run wizard and the Administrator panel (S0-12) ([#80](https://github.com/trybun/trybun/issues/80)) ([d27d4c6](https://github.com/trybun/trybun/commit/d27d4c6b93f661430359619f17dc2b6de81bbaf1))
* add the internationalization infrastructure (S0-06) ([#62](https://github.com/trybun/trybun/issues/62)) ([9cc2218](https://github.com/trybun/trybun/commit/9cc22182f43f179b6f5d872b44e6295b3763f92b)), closes [#30](https://github.com/trybun/trybun/issues/30)
* add the Keycloak realm configuration and the sign-in with Auth.js (S0-05) ([#45](https://github.com/trybun/trybun/issues/45)) ([746a44f](https://github.com/trybun/trybun/commit/746a44f87b4d035eb7ec635ee566cdcd11d02d39))
* add the password policy of the sign-in (S0-20) ([#84](https://github.com/trybun/trybun/issues/84)) ([e0281ea](https://github.com/trybun/trybun/commit/e0281ea38db9a4ea5d7af386d43227f6b87bf9d4))
* add the product tour infrastructure and the First login tour (S0-10) ([#69](https://github.com/trybun/trybun/issues/69)) ([2960e54](https://github.com/trybun/trybun/commit/2960e54ef9d1909e14e52101c60db8b4c5f8028a))
* add the release pipeline with image scan, SBOM and deployment package (S0-11) ([#70](https://github.com/trybun/trybun/issues/70)) ([0992715](https://github.com/trybun/trybun/commit/09927159f5fbb453513ee6a992892a6d878f5785))
* add the security baseline (S0-14) ([#86](https://github.com/trybun/trybun/issues/86)) ([545ecdd](https://github.com/trybun/trybun/commit/545ecdded8bd8d3322a98b37a5ef46e2d9964cbe))
* add the update, backup and restore commands and the backup service (S0-13) ([#85](https://github.com/trybun/trybun/issues/85)) ([f2034cc](https://github.com/trybun/trybun/commit/f2034cc047a62a2c9b00bb593d2c9eb2d0cf779f))
* **deploy:** add Docker Compose for development and production (S0-03) ([#43](https://github.com/trybun/trybun/issues/43)) ([c9a3157](https://github.com/trybun/trybun/commit/c9a3157b43af2edff23abeab73f18e58bb9577fe)), closes [#27](https://github.com/trybun/trybun/issues/27)
* scaffold the monorepo with the web app, the server and shared packages (S0-01) ([#7](https://github.com/trybun/trybun/issues/7)) ([82e5c0d](https://github.com/trybun/trybun/commit/82e5c0df26d8f56b010e813bbea6dd3f22d2d695))
* **server:** add Prisma, the base schema, the outbox and BullMQ queues (S0-04) ([#44](https://github.com/trybun/trybun/issues/44)) ([38ee0bb](https://github.com/trybun/trybun/commit/38ee0bb5c946edbcf897089ed6b1d622849c6245)), closes [#28](https://github.com/trybun/trybun/issues/28)
* **server:** remove the IP addresses of the audit log after 14 days (S0-21) ([#89](https://github.com/trybun/trybun/issues/89)) ([d416553](https://github.com/trybun/trybun/commit/d4165530d0c2dbcadc1e0f33e201ab9600466ef0)), closes [#87](https://github.com/trybun/trybun/issues/87)
* **ui:** add the component library on shadcn/ui and Base UI (S0-07) ([#64](https://github.com/trybun/trybun/issues/64)) ([50517fa](https://github.com/trybun/trybun/commit/50517fa8f589174940508d6c41afef13d59fe098))
* **web:** add the user documentation and the help viewer (S0-09) ([#67](https://github.com/trybun/trybun/issues/67)) ([a34d5e5](https://github.com/trybun/trybun/commit/a34d5e550d984258688b53d0f92acb72e9be7333))


### Fixed

* **deps:** bump adorsys/keycloak-config-cli from 6.5.1-26.1.0 to 6.5.1-26.5.5 ([#47](https://github.com/trybun/trybun/issues/47)) ([7f5aec4](https://github.com/trybun/trybun/commit/7f5aec4a561494ea3c5d8c89f9f3ca723232304c))
* **deps:** bump bullmq from 6.3.15 to 6.3.16 in the npm group ([#60](https://github.com/trybun/trybun/issues/60)) ([00abd64](https://github.com/trybun/trybun/commit/00abd64f5982ea8a89c324aefa7364c54bb644c9))
* **deps:** Bump the npm group with 7 updates ([70177bc](https://github.com/trybun/trybun/commit/70177bcdd3fdc051bc89c1ea850186d8487d1ccb))
* **deps:** bump the npm group with 7 updates ([#48](https://github.com/trybun/trybun/issues/48)) ([70177bc](https://github.com/trybun/trybun/commit/70177bcdd3fdc051bc89c1ea850186d8487d1ccb))
* **deps:** update body-parser to 2.4.0 (GHSA-27r3-jxmh-p828) ([#55](https://github.com/trybun/trybun/issues/55)) ([f5ad27f](https://github.com/trybun/trybun/commit/f5ad27ff8a89e009f738a6490383e29a0986cffc)), closes [#54](https://github.com/trybun/trybun/issues/54)
* **deps:** update multer to 2.5.0 (GHSA-q7qp-rjg7-q26m) ([#57](https://github.com/trybun/trybun/issues/57)) ([0a8a086](https://github.com/trybun/trybun/commit/0a8a086e8c1b2f7715aacc22e7dd429422a7d10e))
* **deps:** update undici to 8.12.2 (GHSA-xjj6-f33q-929c) ([#58](https://github.com/trybun/trybun/issues/58)) ([fe647b9](https://github.com/trybun/trybun/commit/fe647b9005fb2f3cb21f3dcc566c099dcb4500b2))
* **web:** bring the simulated LCP of the empty shell below the budget ([#74](https://github.com/trybun/trybun/issues/74)) ([f46990d](https://github.com/trybun/trybun/commit/f46990d1098e1fab730d019cfb86c3615fef0509))
* **web:** load the header menus after the first paint of the shell ([#75](https://github.com/trybun/trybun/issues/75)) ([fa0bc18](https://github.com/trybun/trybun/commit/fa0bc181eb55b8812289726c174a30afc0637f3d))
