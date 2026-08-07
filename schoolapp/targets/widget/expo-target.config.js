/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "widget",
  name: "MealWidget",
  icon: "https://github.com/expo.png", // 나중에 학교 로고 이미지 URL이나 로컬 경로로 교체 가능
  colors: {
    $accent: "#556B2F",
  },
  entitlements: {
    "com.apple.security.application-groups": ["group.com.ymk.schoolapp"],
  },
});
