{
  "targets": [
    {
      "target_name": "masbookmarks",
      "sources": ["bookmarks.mm"],
      "xcode_settings": {
        "OTHER_CPLUSPLUSFLAGS": ["-fobjc-arc"],
        "MACOSX_DEPLOYMENT_TARGET": "13.0"
      },
      "link_settings": { "libraries": ["-framework Foundation"] }
    }
  ]
}
