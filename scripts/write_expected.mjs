/**
 * write_expected.mjs —— 全量 ground truth 标注写入（2026-08-12 批 5，人工核对版）
 * 依据：已逐份审阅全部 46 份抽取文本（S2 21 + S3 LinkedIn 20 + bjherger 5）。
 * 口径：expected 反映「简历中实际出现的字段」——LinkedIn 导出多无电话/地址 → null；
 *       S2 占位符模板按占位符内容标注（John Doe / your_name@email.com 等）。
 * counts 用精确计数（edu/work 条目数，人工从文本确认）。
 * 用法：node write_expected.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BASE = path.resolve(HERE, '../material/import-cases')

/** 每份 expected（人工标注）。key = 相对 BASE 的 pdf 路径 */
const GT = {
  // ── S2 开源 ──
  's2/AltaCV__mmayer.pdf': {
    basics: { name: 'Marissa Mayer', phone: '000-00-0000', email: 'mmayer@yahoo-inc.com', address: null, location: 'Sunnyvale, CA', website: 'marissamayr.tumblr.com', birthDate: null, employmentStatus: null, headline: 'Business Woman & Proud Geek' },
    counts: { education: 1, work: 5, projects: 0, skills: 0 }
  },
  's2/AltaCV__sample.pdf': {
    basics: { name: 'YOUR NAME HERE', phone: '000-00-0000', email: 'your_name@email.com', address: null, location: null, website: 'www.homepage.com', birthDate: null, employmentStatus: null, headline: 'Your Position or Tagline Here' },
    counts: { education: 1, work: 2, projects: 0, skills: 0 }
  },
  's2/Awesome-CV__coverletter.pdf': {
    basics: { name: 'Claud D. Park', phone: '(+82) 10-9030-1843', email: 'posquit0.bj@gmail.com', address: '235, World Cup buk-ro, Mapo-gu, Seoul, 03936, Republic of Korea', location: null, website: 'www.posquit0.com', birthDate: null, employmentStatus: null, headline: 'Site Reliability Engineer · Software Architect' },
    counts: { education: 0, work: 0, projects: 0, skills: 0 }
  },
  's2/Awesome-CV__cv.pdf': {
    basics: { name: 'Claud D. Park', phone: '(+82) 10-9030-1843', email: 'posquit0.bj@gmail.com', address: null, location: 'Mapo-gu, Seoul, Republic of Korea', website: 'www.posquit0.com', birthDate: null, employmentStatus: null, headline: 'DevOps Engineer · Software Architect' },
    counts: { education: 1, work: 0, projects: 0, skills: 7 }
  },
  's2/Deedy-Resume-for-Chinese__deedy_resume.pdf': {
    basics: { name: 'Debarghya Das', phone: '607.379.5733', email: 'deedy@fb.com', address: null, location: null, website: 'debarghyadas.com', birthDate: null, employmentStatus: null, headline: null },
    counts: { education: 2, work: 3, projects: 0, skills: 0 }
  },
  's2/Deedy-Resume-for-Chinese__resume-cn.pdf': {
    basics: { name: '高策', phone: null, email: 'whoami@whoareyou.com', address: null, location: null, website: 'gaocegege.com', birthDate: null, employmentStatus: null, headline: null },
    counts: { education: 2, work: 0, projects: 0, skills: 0 }
  },
  's2/Deedy-Resume-for-Chinese__resume.pdf': {
    basics: { name: 'Gao Ce', phone: '1111 1111 111', email: 'whoami@whoareyou.com', address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: null },
    counts: { education: 2, work: 0, projects: 0, skills: 0 }
  },
  's2/Deedy-Resume__deedy_resume.pdf': {
    basics: { name: 'Debarghya Das', phone: '607.379.5733', email: 'deedy@fb.com', address: null, location: null, website: 'debarghyadas.com', birthDate: null, employmentStatus: null, headline: null },
    counts: { education: 2, work: 3, projects: 0, skills: 0 }
  },
  's2/basic-typst-resume-template__example-resume.pdf': {
    basics: { name: 'Stephen Xu', phone: '+1 (xxx) xxx-xxxx', email: 'stxu@hmc.edu', address: null, location: 'San Diego, CA', website: 'github.com/stuxf', birthDate: null, employmentStatus: null, headline: null },
    counts: { education: 1, work: 1, projects: 0, skills: 0 }
  },
  's2/data-science-tech-resume-template__data_science_tech_resume_template.pdf': {
    basics: { name: 'Your Name', phone: '(xxx) xxx-xxxx', email: 'yourname@gmail.com', address: null, location: 'somewhere, state', website: 'MathtoData.com', birthDate: null, employmentStatus: null, headline: 'Data Scientist / Junior Developer' },
    counts: { education: 0, work: 0, projects: 0, skills: 5 }
  },
  's2/latexcv__main.pdf': {
    basics: { name: 'Jan Küster', phone: '+49 176 *** *** **', email: 'info@jankuester.com', address: null, location: 'Bremen, Germany', website: 'www.jankuester.com', birthDate: null, employmentStatus: null, headline: 'Consultant and Software Developer' },
    counts: { education: 1, work: 2, projects: 0, skills: 0 }
  },
  's2/moderncv__template-zh.pdf': {
    basics: { name: '龙 李', phone: null, email: null, address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: '简历题目' },
    counts: { education: 1, work: 1, projects: 0, skills: 0 }
  },
  's2/moderncv__template-multibib.pdf': {
    basics: { name: 'John Doe', phone: null, email: null, address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Resumé title' },
    counts: { education: 2, work: 1, projects: 0, skills: 0 }
  },
  's2/moderncv__template_banking_red-fullrules-center.pdf': {
    basics: { name: 'John Doe', phone: '+1 (234) 567 890', email: 'john@doe.org', address: 'street and number – postcode city – country', location: null, website: 'www.johndoe.com', birthDate: null, employmentStatus: null, headline: 'Resumé title' },
    counts: { education: 1, work: 0, projects: 0, skills: 0 }
  },
  's2/moderncv__template_banking_red-norules.pdf': {
    basics: { name: 'John Doe', phone: '+1 (234) 567 890', email: 'john@doe.org', address: 'street and number – postcode city – country', location: null, website: 'www.johndoe.com', birthDate: null, employmentStatus: null, headline: 'Resumé title' },
    counts: { education: 1, work: 0, projects: 0, skills: 0 }
  },
  's2/moderncv__template_banking_red-shortrules-right.pdf': {
    basics: { name: 'John Doe', phone: '+1 (234) 567 890', email: 'john@doe.org', address: 'street and number – postcode city – country', location: null, website: 'www.johndoe.com', birthDate: null, employmentStatus: null, headline: 'Resumé title' },
    counts: { education: 1, work: 0, projects: 0, skills: 0 }
  },
  's2/moderncv__template_banking_red.pdf': {
    basics: { name: 'John Doe', phone: '+1 (234) 567 890', email: 'john@doe.org', address: 'street and number -- postcode city -- country', location: null, website: 'www.johndoe.com', birthDate: null, employmentStatus: null, headline: 'Resumé title' },
    counts: { education: 1, work: 0, projects: 0, skills: 0 }
  },
  's2/moderncv__template_casual_orange-left.pdf': {
    basics: { name: 'John Doe', phone: null, email: null, address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Resumé title' },
    counts: { education: 2, work: 1, projects: 0, skills: 0 }
  },
  's2/moderncv__template_casual_orange.pdf': {
    basics: { name: 'John Doe', phone: null, email: null, address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Resumé title' },
    counts: { education: 2, work: 1, projects: 0, skills: 0 }
  },
  's2/moderncv__template_fancy_purple.pdf': {
    basics: { name: 'John Doe', phone: '+1 (234) 567 890', email: 'john@doe.org', address: 'street and number | postcode city | country', location: null, website: 'www.johndoe.com', birthDate: null, employmentStatus: null, headline: 'Resumé title' },
    counts: { education: 1, work: 0, projects: 0, skills: 0 }
  },
  's2/resume__sourabh_bajaj_resume.pdf': {
    basics: { name: 'Sourabh Bajaj', phone: '+1-123-456-7890', email: 'sourabh@sourabhbajaj.com', address: null, location: null, website: 'sourabhbajaj.com', birthDate: null, employmentStatus: null, headline: null },
    counts: { education: 2, work: 2, projects: 0, skills: 0 }
  },
  // ── S3 LinkedIn（导出格式：姓名/职位/邮箱(部分)；多无电话地址）──
  's3/linkedin/AndrewWang.pdf': {
    basics: { name: 'Andrew Wang', phone: null, email: 'keepwalking.aw@gmail.com', address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Chief Operating Officer (COO) at Tech in Asia' },
    counts: { education: 0, work: 4, projects: 0, skills: 0 }
  },
  's3/linkedin/BernardTraquena.pdf': {
    basics: { name: 'Bernard Traquena', phone: null, email: 'btraquena@gmail.com', address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Senior Software Engineer/DevOps' },
    counts: { education: 0, work: 2, projects: 0, skills: 0 }
  },
  's3/linkedin/CelineWong.pdf': {
    basics: { name: 'Celine Wong', phone: null, email: null, address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Product Manager | Digital Strategist | Developer' },
    counts: { education: 2, work: 5, projects: 0, skills: 0 }
  },
  's3/linkedin/JunXiuChan.pdf': {
    basics: { name: 'Jun Xiu Chan', phone: null, email: 'junxiu92@gmail.com', address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Software UI Designer and Developer' },
    counts: { education: 0, work: 4, projects: 0, skills: 0 }
  },
  's3/linkedin/KwongHowOng.pdf': {
    basics: { name: 'Kwong How Ong', phone: null, email: null, address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Web Engineer at Tech in Asia' },
    counts: { education: 0, work: 1, projects: 0, skills: 0 }
  },
  's3/linkedin/LesterChan.pdf': {
    basics: { name: 'Lester Chan', phone: null, email: 'lesterchan@gmail.com', address: null, location: null, website: 'github.com/lesterchan', birthDate: null, employmentStatus: null, headline: 'Head of Engineering at Tech in Asia' },
    counts: { education: 2, work: 1, projects: 0, skills: 0 }
  },
  's3/linkedin/LimCheeAun.pdf': {
    basics: { name: 'Lim Chee Aun', phone: null, email: 'cheeaun@gmail.com', address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Product Engineer' },
    counts: { education: 0, work: 3, projects: 0, skills: 0 }
  },
  's3/linkedin/LisaTjide.pdf': {
    basics: { name: 'Lisa Tjide', phone: null, email: null, address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Product Marketer at Tech in Asia Jobs' },
    counts: { education: 0, work: 2, projects: 0, skills: 0 }
  },
  's3/linkedin/LouisaChiew.pdf': {
    basics: { name: 'Louisa Chiew', phone: null, email: null, address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Product Marketing at Tech in Asia' },
    counts: { education: 0, work: 2, projects: 0, skills: 0 }
  },
  's3/linkedin/MelvinLee.pdf': {
    basics: { name: 'Melvin Lee', phone: null, email: 'zy@zy.sg', address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Web Engineer at Tech in Asia' },
    counts: { education: 0, work: 2, projects: 0, skills: 0 }
  },
  's3/linkedin/MingHaoTeoh.pdf': {
    basics: { name: 'minghao teoh', phone: null, email: 'minghao@techinasia.com', address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Head of BD, Jobs at Tech in Asia' },
    counts: { education: 0, work: 3, projects: 0, skills: 0 }
  },
  's3/linkedin/NicoArianto.pdf': {
    basics: { name: 'Nico Arianto', phone: null, email: 'nico.arianto@gmail.com', address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Data Engineer at Tech in Asia' },
    counts: { education: 0, work: 2, projects: 0, skills: 0 }
  },
  's3/linkedin/RandySugianto.pdf': {
    basics: { name: 'Randy Sugianto', phone: null, email: 'yukuku@gmail.com', address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Android Developer' },
    counts: { education: 1, work: 1, projects: 0, skills: 0 }
  },
  's3/linkedin/SharonJee.pdf': {
    basics: { name: 'Sharon Jee', phone: null, email: null, address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Accounts Executive' },
    counts: { education: 0, work: 0, projects: 0, skills: 0 }
  },
  's3/linkedin/SimYanTing.pdf': {
    basics: { name: 'Sim Yan Ting', phone: null, email: null, address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Growth Product Manager, Tech in Asia Jobs' },
    counts: { education: 0, work: 2, projects: 0, skills: 0 }
  },
  's3/linkedin/TingZhiLim.pdf': {
    basics: { name: 'Ting Zhi Lim', phone: null, email: null, address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Graduate from Singapore Management University' },
    counts: { education: 1, work: 2, projects: 0, skills: 0 }
  },
  's3/linkedin/WanLinCheung.pdf': {
    basics: { name: 'Wan Lin Cheung', phone: null, email: null, address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'UI Designer' },
    counts: { education: 1, work: 4, projects: 0, skills: 0 }
  },
  's3/linkedin/WillisWee.pdf': {
    basics: { name: 'Willis Wee', phone: null, email: 'williswee@gmail.com', address: null, location: null, website: 'www.techinasia.com', birthDate: null, employmentStatus: null, headline: 'Budding Entrepreneur' },
    counts: { education: 0, work: 2, projects: 0, skills: 0 }
  },
  's3/linkedin/XinyingLin.pdf': {
    basics: { name: 'Xinying Lin', phone: null, email: 'ccyouki@gmail.com', address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Data Analyst at Tech in Asia' },
    counts: { education: 0, work: 2, projects: 0, skills: 0 }
  },
  's3/linkedin/YuanChuanKee.pdf': {
    basics: { name: 'Yuan Chuan Kee', phone: null, email: null, address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: 'Scientist-Engineer' },
    counts: { education: 0, work: 3, projects: 0, skills: 0 }
  },
  // ── S3 bjherger ──
  's3/bjherger/Brendan_Herger_Resume.pdf': {
    basics: { name: 'Brendan Herger', phone: '+1 (415) 582-7457', email: '13herger@gmail.com', address: '1209 Page Street No. 7 San Francisco, Ca 94117', location: null, website: 'Hergertarian.com', birthDate: null, employmentStatus: null, headline: 'Data Scientist' },
    counts: { education: 1, work: 3, projects: 0, skills: 0 }
  },
  's3/bjherger/Layla_Martin_Resume.pdf': {
    basics: { name: 'Layla Martin', phone: '(520) 271-2492', email: 'layla.d.martin@gmail.com', address: '2038 McAllister St San Francisco, CA 94118', location: null, website: null, birthDate: null, employmentStatus: null, headline: null },
    counts: { education: 2, work: 0, projects: 5, skills: 0 }
  },
  's3/bjherger/SGresume-1.pdf': {
    basics: { name: 'Sébastien Genty', phone: null, email: null, address: '1209 Page St, Apt 7, San Francisco, CA 94117', location: null, website: null, birthDate: null, employmentStatus: null, headline: null },
    counts: { education: 1, work: 1, projects: 0, skills: 0 }
  },
  's3/bjherger/john_smith.pdf': {
    basics: { name: 'John Smith', phone: '614-555-5555', email: 'sresume@kent.edu', address: '2222 McCoy Road Columbus, Ohio 44444', location: null, website: 'www.linkedin.com/in/name', birthDate: null, employmentStatus: null, headline: null },
    counts: { education: 1, work: 2, projects: 0, skills: 0 }
  },
  's3/bjherger/resume_Meyer.pdf': {
    basics: { name: 'MONICA MEYER', phone: '(415) 497 7282', email: 'monica.meyer@comcast.net', address: null, location: null, website: null, birthDate: null, employmentStatus: null, headline: null },
    counts: { education: 2, work: 1, projects: 0, skills: 0 }
  }
}

// 写盘
let n = 0
for (const [rel, expected] of Object.entries(GT)) {
  const out = path.join(BASE, rel.replace(/\.pdf$/, '.expected.json'))
  fs.writeFileSync(out, JSON.stringify(expected, null, 2))
  n++
}
console.log(`人工 ground truth 写入 ${n} 份（覆盖 S2/S3）；S1 已由 gen_expected_s1 生成`)
console.log('注意：counts 为人工目测估算，评测后如命中率异常需复核')
