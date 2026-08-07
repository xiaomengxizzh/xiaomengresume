import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhCN from './zh-CN.json'
import en from './en.json'

/**
 * i18n 脚手架（M0）
 * 铁律（《项目规范.md》4.1）：任何 UI 文案从第一行代码起走 t('key')，禁止硬编码中文字符串；
 * 两语言 JSON 结构必须对称。默认语言 zh-CN（T 批 #24），不跟系统解析。
 */
void i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    en: { translation: en }
  },
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false }
})

// 语言切换时同步 HTML lang（无障碍/发音提示用），M1 语言切换 UI 接入后生效
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export default i18n
