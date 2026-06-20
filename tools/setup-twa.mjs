// Google Playストア提出用のAndroid(TWA)プロジェクトを非対話的に生成する。1回限りのセットアップスクリプト。
import {
  TwaManifest,
  TwaGenerator,
  JdkHelper,
  KeyTool,
  Config,
  ConsoleLog,
} from "@bubblewrap/core";
import fs from "fs";
import crypto from "crypto";

const PACKAGE_ID = "com.adgrky.railmap";
const MANIFEST_URL = "https://adgrky.github.io/railmap/manifest.webmanifest";
const TARGET_DIR = "./android-twa";
const KEYSTORE_PASSWORD = crypto.randomBytes(16).toString("base64").replace(/[+/=]/g, "");
const KEY_PASSWORD = crypto.randomBytes(16).toString("base64").replace(/[+/=]/g, "");
const KEY_ALIAS = "railmap-release";

const log = new ConsoleLog("setup-twa");

async function main() {
  const twaManifest = await TwaManifest.fromWebManifest(MANIFEST_URL);
  twaManifest.packageId = PACKAGE_ID;
  twaManifest.launcherName = "路線埋立マップ"; // ランチャー表示名は短め
  twaManifest.appVersionName = "1.0.0";
  twaManifest.appVersionCode = 1;
  twaManifest.signingKey = { path: "./android.keystore", alias: KEY_ALIAS };
  // OFM/MapLibreがキャンバスで地図を描くため、フォールバックはWebViewが安定
  twaManifest.fallbackType = "webview";

  const err = twaManifest.validate();
  if (err) {
    console.error("twa-manifest validation failed:", err);
    process.exit(1);
  }

  fs.mkdirSync(TARGET_DIR, { recursive: true });
  await twaManifest.saveToFile(`${TARGET_DIR}/twa-manifest.json`);

  const generator = new TwaGenerator();
  await generator.createTwaProject(TARGET_DIR, twaManifest, log);
  console.log("✅ TWAプロジェクト生成完了:", TARGET_DIR);

  // 署名鍵(keystore)を生成。これを失くすと今後Playストアで同じアプリを更新できなくなる。
  const config = new Config(
    "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk",
    "/Users/ken/Library/Android/sdk"
  );
  const jdkHelper = new JdkHelper(process, config);
  const keyTool = new KeyTool(jdkHelper, log);

  await keyTool.createSigningKey({
    path: `${TARGET_DIR}/android.keystore`,
    alias: KEY_ALIAS,
    password: KEYSTORE_PASSWORD,
    keypassword: KEY_PASSWORD,
    fullName: "Ken",
    organizationalUnit: "railmap",
    organization: "adgrky",
    country: "JP",
  });
  console.log("✅ 署名鍵 (android.keystore) 生成完了");

  // パスワードはgit管理外のローカルファイルにのみ保存
  const credsPath = `${TARGET_DIR}/KEYSTORE_CREDENTIALS.txt`;
  fs.writeFileSync(
    credsPath,
    [
      "## 重要: このファイルは絶対にgit管理しない / 公開しない ##",
      "このパスワードと android.keystore を失くすと、今後このアプリをPlayストアで",
      "更新できなくなります(同じpackageIdで新規アプリは出せません)。",
      "1Passwordなど安全な場所に必ずコピーしてから、このファイルは削除してください。",
      "",
      `keystore path: ${TARGET_DIR}/android.keystore`,
      `key alias: ${KEY_ALIAS}`,
      `keystore password: ${KEYSTORE_PASSWORD}`,
      `key password: ${KEY_PASSWORD}`,
      `package id: ${PACKAGE_ID}`,
    ].join("\n")
  );
  console.log("✅ 認証情報を一時保存:", credsPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
