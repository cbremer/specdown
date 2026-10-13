// Security-scoped bookmarks for the Mac App Store (sandboxed) build.
//
// Electron can only create bookmarks from its own open/save panels and cannot
// resolve a bookmark to a path, so files opened from Finder or by
// drag-and-drop could never be reopened after a relaunch, and a moved file's
// stale bookmark silently grants nothing. These three calls close that gap
// (see docs/project-appstore/mas-interface.md). Foundation only; main thread
// only; loaded exclusively by desktop/mas-access.js in the MAS build.
//
//   createBookmark(path) -> base64     needs a live grant (sandbox-enforced)
//   startAccess(base64)  -> { id, path, stale, ok }
//   stopAccess(id)       -> boolean    balances one startAccess

#import <Foundation/Foundation.h>
#include <node_api.h>
#include <string>

static NSMutableDictionary<NSNumber*, NSURL*>* gActive;
static int64_t gNextId = 1;

static napi_value MakeString(napi_env env, NSString* s) {
  napi_value v;
  napi_create_string_utf8(env, [s UTF8String], NAPI_AUTO_LENGTH, &v);
  return v;
}

static bool ReadString(napi_env env, napi_callback_info info, NSString** out) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  napi_valuetype type;
  if (argc < 1 || napi_typeof(env, argv[0], &type) != napi_ok || type != napi_string) {
    napi_throw_type_error(env, nullptr, "expected a string argument");
    return false;
  }
  size_t len = 0;
  napi_get_value_string_utf8(env, argv[0], nullptr, 0, &len);
  std::string buf(len + 1, '\0');
  napi_get_value_string_utf8(env, argv[0], &buf[0], len + 1, &len);
  *out = [NSString stringWithUTF8String:buf.c_str()];
  return *out != nil;
}

static void ThrowNSError(napi_env env, NSError* err, const char* fallback) {
  napi_throw_error(env, nullptr, err ? [[err localizedDescription] UTF8String] : fallback);
}

static napi_value CreateBookmark(napi_env env, napi_callback_info info) {
  NSString* path;
  if (!ReadString(env, info, &path)) return nullptr;
  NSError* err = nil;
  NSData* data = [[NSURL fileURLWithPath:path]
             bookmarkDataWithOptions:NSURLBookmarkCreationWithSecurityScope
      includingResourceValuesForKeys:nil
                       relativeToURL:nil
                               error:&err];
  if (!data) {
    ThrowNSError(env, err, "could not create bookmark");
    return nullptr;
  }
  return MakeString(env, [data base64EncodedStringWithOptions:0]);
}

static napi_value StartAccess(napi_env env, napi_callback_info info) {
  NSString* b64;
  if (!ReadString(env, info, &b64)) return nullptr;
  NSData* data = [[NSData alloc] initWithBase64EncodedString:b64 options:0];
  if (!data) {
    napi_throw_error(env, nullptr, "bookmark is not valid base64");
    return nullptr;
  }
  BOOL stale = NO;
  NSError* err = nil;
  NSURL* url = [NSURL URLByResolvingBookmarkData:data
                                         options:NSURLBookmarkResolutionWithSecurityScope |
                                                 NSURLBookmarkResolutionWithoutUI
                                   relativeToURL:nil
                             bookmarkDataIsStale:&stale
                                           error:&err];
  if (!url) {
    ThrowNSError(env, err, "could not resolve bookmark");
    return nullptr;
  }
  BOOL ok = [url startAccessingSecurityScopedResource];
  int64_t accessId = 0;
  if (ok) {
    if (!gActive) gActive = [NSMutableDictionary dictionary];
    accessId = gNextId++;
    gActive[@(accessId)] = url;
  }
  napi_value result, id, okValue, staleValue;
  napi_create_object(env, &result);
  napi_create_int64(env, accessId, &id);
  napi_get_boolean(env, ok, &okValue);
  napi_get_boolean(env, stale, &staleValue);
  napi_set_named_property(env, result, "id", id);
  napi_set_named_property(env, result, "path", MakeString(env, [url path]));
  napi_set_named_property(env, result, "stale", staleValue);
  napi_set_named_property(env, result, "ok", okValue);
  return result;
}

static napi_value StopAccess(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  int64_t accessId = 0;
  bool stopped = false;
  if (argc >= 1 && napi_get_value_int64(env, argv[0], &accessId) == napi_ok) {
    NSURL* url = gActive[@(accessId)];
    if (url) {
      [url stopAccessingSecurityScopedResource];
      [gActive removeObjectForKey:@(accessId)];
      stopped = true;
    }
  }
  napi_value result;
  napi_get_boolean(env, stopped, &result);
  return result;
}

static napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor props[] = {
      {"createBookmark", nullptr, CreateBookmark, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"startAccess", nullptr, StartAccess, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"stopAccess", nullptr, StopAccess, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  napi_define_properties(env, exports, 3, props);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
