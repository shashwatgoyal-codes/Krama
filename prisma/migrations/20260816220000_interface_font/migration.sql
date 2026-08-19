-- Interface font, as the design's Appearance tab offers: the app's own
-- pairing, or whatever the operating system uses. The second exists
-- because a webfont is a download and a rendering difference, and some
-- people would simply rather not.
ALTER TABLE "profiles"
  ADD COLUMN "interfaceFont" TEXT NOT NULL DEFAULT 'krama';

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_interface_font"
  CHECK ("interfaceFont" IN ('krama', 'system'));
