/**
 * CSS ve varlik (asset) yan etkili (side-effect) import'lari icin tip bildirimi.
 *
 * TypeScript 5.6+ ile `import "./globals.css"` satiri TS2882 hatasi verir;
 * bu bildirim derleyiciye CSS import'unun gecerli oldugunu soyler.
 */
declare module "*.css";
declare module "*.svg";
declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.webp";
