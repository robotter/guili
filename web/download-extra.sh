#!/bin/bash
set -e

dir="$(dirname "$0")"
dl_dir="$dir/_dl"
inst_dir="$dir/extra"
force=


download() {
  local url="$1"
  local file="${2:-$(basename "$url")}"
  if [ -z "$force" ] && [ -f "$dl_dir/$file" ]; then
    echo "$file already downloaded, skip"
    return
  fi
  echo "downloading $file"
  mkdir -p "$dl_dir"
  curl -s -o "$dl_dir/$file" "$url"
}

install() {
  local src="$1"
  local dest="$2"
  [[ $dest =~ /$ ]] && dest="$dest$(basename "$src")"
  echo "installing $dest"
  rm -fr "$inst_dir/$dest"
  mkdir -p "$(dirname "$inst_dir/$dest")"
  mv "$src" "$inst_dir/$dest" 
}


get_fontawesome() {
  echo "get font-awesome $1"
  local name="font-awesome-$1"
  download "http://fortawesome.github.io/Font-Awesome/assets/font-awesome-$1.zip" "$name.zip"
  rm -fr "$dl_dir/$name"
  ( cd _dl && unzip -x "$name.zip" )
  install "$dl_dir/$name/css/font-awesome.min.css" css/
  for f in "$dl_dir/$name"/fonts/fontawesome-webfont.*; do
    install "$f" fonts/
  done
  rm -fr "$dl_dir/$name"
}

get_jquery() {
  echo "get jquery $1"
  download "http://code.jquery.com/jquery-$1.min.js"
  install "$dl_dir/jquery-$1.min.js" js/jquery.min.js
}

get_jquery_ui() {
  echo "get jquery-ui $1"
  local name="jquery-ui-$1"
  download "http://jqueryui.com/resources/download/jquery-ui-$1.zip"
  rm -fr "$dl_dir/$name"
  ( cd _dl && unzip -x "$name.zip" )
  install "$dl_dir/$name/ui/minified/jquery-ui.min.js" js/
  install "$dl_dir/$name/themes/base/minified/jquery-ui.min.css" css/
  for f in "$dl_dir/$name/themes/base/minified/images"/*; do
    install "$f" css/images/
  done
  rm -fr "$dl_dir/$name"
}

get_flot() {
  echo "get flot $1"
  download "http://www.flotcharts.org/downloads/flot-$1.zip"
  rm -fr "$dl_dir/float"
  ( cd _dl && unzip -x "flot-$1.zip" )
  install "$dl_dir/flot/jquery.flot.min.js" js/
  install "$dl_dir/flot/jquery.flot.resize.min.js" js/
  install "$dl_dir/flot/jquery.flot.navigate.min.js" js/
  rm -fr "$dl_dir/flot"
}


rm -fr "$inst_dir"/*

get_fontawesome 4.6.2
get_jquery 1.11.0
get_jquery_ui 1.10.4
get_flot 0.8.2

