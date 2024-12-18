// copied from https://github.com/forcedotcom/source-deploy-retrieve/blob/main/src/common/constants.ts
// all credits to mshanemc
export const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>\n';
export const XML_NS_URL = 'http://soap.sforce.com/2006/04/metadata';
export const XML_NS_KEY = '@_xmlns';
export const XML_COMMENT_PROP_NAME = '#xml__comment';

export type PackageTypeMembers = {
  name: string;
  members: string[];
};

export type PackageManifestObject = {
  Package: {
    types: PackageTypeMembers[];
    version: string;
    fullName?: string;
    [XML_NS_KEY]?: string;
  };
};
