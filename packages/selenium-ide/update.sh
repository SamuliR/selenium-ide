#!/bin/sh
webstore upload --source build/build.zip --extension-id $EXTENSION_ID --client-id $CLIENT_ID --client-secret $CLIENT_SECRET --refresh-token '${REFRESH_TOKEN}' --auto-publish
