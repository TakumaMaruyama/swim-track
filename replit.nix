{pkgs}: {
  deps = [
    pkgs.imagemagick
    pkgs.nodejs
    pkgs.nodePackages.typescript-language-server
    pkgs.postgresql
  ];
}
