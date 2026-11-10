import type { Lesson } from "./types";

// Original teaching material focused on the preposition patterns TOEIC Part 5 tests most.
export const prepositions: Lesson = {
  id: "prepositions",
  title: "คำบุพบท",
  english: "Prepositions",
  summary: "at / on / in, for / by / until และบุพบทที่มักโดนหลอกใน Part 5",
  sections: [
    {
      id: "time",
      title: "เวลา: at / on / in",
      intro:
        "เลือกจากขนาดของเวลา at ใช้กับจุดเวลาที่เจาะจง on ใช้กับวันหรือวันที่ ส่วน in ใช้กับช่วงที่ยาวกว่าหนึ่งวัน เช่น เดือน ปี ฤดู และช่วงของวัน",
      rules: [
        {
          word: "at",
          use: "เวลาที่ระบุเป็นจุด เช่น นาฬิกา เที่ยง กลางคืน",
          examples: "at 9:30 a.m., at noon, at night",
        },
        { word: "on", use: "วันในสัปดาห์ วันที่ วันหยุด", examples: "on Monday, on June 15, on Friday morning" },
        { word: "in", use: "เดือน ปี ฤดู ไตรมาส และช่วงของวัน", examples: "in July, in 2026, in the morning" },
      ],
      examples: [
        { en: "The meeting starts at 9:30 a.m.", th: "การประชุมเริ่มเวลา 9:30 น.", mark: "at 9:30 a.m." },
        {
          en: "The new office opens on Monday, June 15.",
          th: "สำนักงานใหม่เปิดวันจันทร์ที่ 15 มิถุนายน",
          mark: "on Monday",
        },
        {
          en: "Sales usually increase in the fourth quarter.",
          th: "ยอดขายมักเพิ่มขึ้นในไตรมาสที่สี่",
          mark: "in the fourth quarter",
        },
        {
          en: "Please submit the report on Friday morning.",
          th: "กรุณาส่งรายงานในเช้าวันศุกร์",
          mark: "on Friday morning",
        },
      ],
      tip: "in the morning แต่ถ้ามีวันกำกับให้ใช้ on เช่น on Friday morning และไม่ต้องใส่ at / on / in หน้า next, last, this, every เช่น next Monday (ไม่ใช่ on next Monday)",
      drills: [
        {
          sentence: "The shuttle bus leaves ___ 7:45 a.m.",
          options: ["at", "on", "in"],
          answer: "at",
          why: "เวลาที่บอกเป็นนาฬิกาเป๊ะ ๆ ใช้ at",
        },
        {
          sentence: "Our annual conference will be held ___ October.",
          options: ["at", "on", "in"],
          answer: "in",
          why: "เดือนเป็นช่วงที่ยาวกว่าหนึ่งวัน ใช้ in",
        },
        {
          sentence: "The store is closed ___ national holidays.",
          options: ["at", "on", "in"],
          answer: "on",
          why: "วันหยุดคือวัน ใช้ on เหมือน on Monday",
        },
        {
          sentence: "Ms. Tan will return from Seoul ___ Thursday afternoon.",
          options: ["at", "on", "in"],
          answer: "on",
          why: "afternoon ปกติใช้ in แต่เมื่อมีวัน (Thursday) กำกับจะเปลี่ยนเป็น on",
        },
        {
          sentence: "Most employees take their vacation ___ the summer.",
          options: ["at", "on", "in"],
          answer: "in",
          why: "ฤดูกาลใช้ in",
        },
      ],
    },
    {
      id: "place",
      title: "สถานที่: at / on / in",
      intro:
        "at ใช้กับจุดที่ไปทำกิจกรรมหรือที่อยู่ที่มีเลขที่ on ใช้กับพื้นผิว ชั้นของอาคาร และชื่อถนน ส่วน in ใช้กับสิ่งที่อยู่ข้างในพื้นที่ปิด เมือง หรือประเทศ",
      rules: [
        {
          word: "at",
          use: "จุดหรือสถานที่ทำกิจกรรม ที่อยู่ที่มีเลขที่",
          examples: "at the front desk, at the airport, at 25 King Street",
        },
        {
          word: "on",
          use: "พื้นผิว ชั้นของอาคาร ชื่อถนน",
          examples: "on the second floor, on the wall, on Main Street",
        },
        { word: "in", use: "ข้างในห้องหรืออาคาร เมือง ประเทศ", examples: "in the lobby, in the warehouse, in Bangkok" },
      ],
      examples: [
        {
          en: "Please leave your keys at the front desk.",
          th: "กรุณาฝากกุญแจไว้ที่เคาน์เตอร์ต้อนรับ",
          mark: "at the front desk",
        },
        {
          en: "The accounting department is on the third floor.",
          th: "แผนกบัญชีอยู่ที่ชั้นสาม",
          mark: "on the third floor",
        },
        { en: "All visitors must wait in the lobby.", th: "ผู้มาติดต่อทุกคนต้องรออยู่ในล็อบบี้", mark: "in the lobby" },
        {
          en: "The company is located at 120 Silom Road.",
          th: "บริษัทตั้งอยู่ที่ 120 ถนนสีลม",
          mark: "at 120 Silom Road",
        },
      ],
      tip: "ที่อยู่ที่มีบ้านเลขที่ใช้ at (at 120 Silom Road) แต่ถ้ามีแค่ชื่อถนนใช้ on (on Silom Road)",
      drills: [
        {
          sentence: "The printer ___ the fourth floor is out of order.",
          options: ["at", "on", "in"],
          answer: "on",
          why: "ชั้นของอาคารใช้ on",
        },
        {
          sentence: "Mr. Lee is waiting for you ___ the reception desk.",
          options: ["at", "on", "in"],
          answer: "at",
          why: "จุดที่ไปติดต่อหรือทำกิจกรรมใช้ at",
        },
        {
          sentence: "Extra chairs are stored ___ the warehouse.",
          options: ["at", "on", "in"],
          answer: "in",
          why: "ของอยู่ข้างในอาคาร ใช้ in",
        },
        {
          sentence: "Our new branch is ___ 48 Sukhumvit Road.",
          options: ["at", "on", "in"],
          answer: "at",
          why: "มีบ้านเลขที่ (48) ใช้ at",
        },
        {
          sentence: "The company's headquarters is ___ Tokyo.",
          options: ["at", "on", "in"],
          answer: "in",
          why: "เมืองใช้ in",
        },
      ],
    },
    {
      id: "duration",
      title: "ระยะเวลาและกำหนดส่ง: for / during / since / by / until / within",
      intro:
        "กลุ่มนี้ออกสอบบ่อยมาก ให้ดูว่าหลังช่องว่างเป็นอะไร: ระยะเวลา (for) เหตุการณ์ (during) จุดเริ่มต้น (since) เส้นตาย (by) จุดสิ้นสุดของสิ่งที่ทำต่อเนื่อง (until) หรือกรอบเวลา (within)",
      rules: [
        { word: "for", use: "ระยะเวลาว่านานเท่าไร", examples: "for three years, for two weeks" },
        {
          word: "during",
          use: "ระหว่างเหตุการณ์หรือช่วงเวลาที่มีชื่อ",
          examples: "during the meeting, during the holiday season",
        },
        { word: "since", use: "ตั้งแต่จุดเริ่มต้น มักใช้กับ have + V3", examples: "since 2019, since last month" },
        { word: "by", use: "ไม่เกินเวลานั้น (เส้นตาย) ทำให้เสร็จครั้งเดียว", examples: "by Friday, by 5 p.m." },
        { word: "until", use: "ทำหรือเป็นอยู่ต่อเนื่องจนถึงเวลานั้น", examples: "until Friday, until further notice" },
        { word: "within", use: "ภายในกรอบเวลา", examples: "within 30 days, within two business days" },
      ],
      examples: [
        { en: "Ms. Park has worked here for six years.", th: "คุณพาร์คทำงานที่นี่มาหกปีแล้ว", mark: "for six years" },
        {
          en: "Mobile phones must be turned off during the presentation.",
          th: "ต้องปิดโทรศัพท์มือถือระหว่างการนำเสนอ",
          mark: "during the presentation",
        },
        {
          en: "Prices have risen steadily since January.",
          th: "ราคาเพิ่มขึ้นต่อเนื่องตั้งแต่เดือนมกราคม",
          mark: "since January",
        },
        {
          en: "Please return the signed contract by May 31.",
          th: "กรุณาส่งสัญญาที่ลงนามแล้วคืนภายในวันที่ 31 พฤษภาคม",
          mark: "by May 31",
        },
        {
          en: "The store will remain closed until further notice.",
          th: "ร้านจะปิดไปจนกว่าจะมีประกาศเพิ่มเติม",
          mark: "until further notice",
        },
        {
          en: "Refunds are processed within five business days.",
          th: "การคืนเงินจะดำเนินการภายในห้าวันทำการ",
          mark: "within five business days",
        },
      ],
      tip: "by กับ until ต่างกันที่กริยา: submit by Friday (ส่งครั้งเดียว ก่อนหรือภายในวันศุกร์) ส่วน stay until Friday (อยู่ต่อเนื่องไปจนถึงวันศุกร์) ถามตัวเองว่ากริยาเกิดครั้งเดียวหรือต่อเนื่อง",
      drills: [
        {
          sentence: "Applications must be received ___ June 30.",
          options: ["by", "until", "since", "for"],
          answer: "by",
          why: "เป็นเส้นตาย การได้รับใบสมัครเกิดครั้งเดียว ใช้ by",
        },
        {
          sentence: "The road will be closed ___ the end of the month.",
          options: ["by", "until", "since", "within"],
          answer: "until",
          why: "ถนนปิดต่อเนื่องไปจนถึงสิ้นเดือน ใช้ until",
        },
        {
          sentence: "Mr. Diaz has managed the team ___ 2021.",
          options: ["for", "during", "since", "by"],
          answer: "since",
          why: "2021 เป็นจุดเริ่มต้น และประโยคใช้ has managed ใช้ since",
        },
        {
          sentence: "The warranty is valid ___ two years.",
          options: ["for", "during", "since", "until"],
          answer: "for",
          why: "two years เป็นระยะเวลา ใช้ for",
        },
        {
          sentence: "Please remain seated ___ the performance.",
          options: ["for", "during", "since", "by"],
          answer: "during",
          why: "the performance เป็นเหตุการณ์ ใช้ during",
        },
        {
          sentence: "Customers will receive a reply ___ 24 hours.",
          options: ["within", "since", "during", "until"],
          answer: "within",
          why: "ได้รับคำตอบภายในกรอบเวลา 24 ชั่วโมง ใช้ within",
        },
      ],
    },
    {
      id: "connectors",
      title: "บุพบทกับคำเชื่อม: because of / despite กับ because / although",
      intro:
        "ข้อสอบชอบให้เลือกระหว่างบุพบทกับคำเชื่อมที่ความหมายเหมือนกัน วิธีแยกคือดูสิ่งที่ตามหลังช่องว่าง ถ้าเป็นคำนาม วลีนาม หรือ V-ing ใช้บุพบท ถ้าเป็นประโยคที่มีประธานและกริยา ใช้คำเชื่อม",
      rules: [
        {
          word: "because of / due to",
          use: "เพราะ + คำนามหรือวลีนาม",
          examples: "because of the storm, due to high demand",
        },
        {
          word: "despite / in spite of",
          use: "แม้ว่า + คำนามหรือ V-ing",
          examples: "despite the rain, despite having little experience",
        },
        {
          word: "because / although",
          use: "คำเชื่อม + ประธาน + กริยา",
          examples: "because it rained, although the price was high",
        },
      ],
      examples: [
        { en: "The flight was delayed because of heavy fog.", th: "เที่ยวบินล่าช้าเพราะหมอกหนา", mark: "because of" },
        { en: "The flight was delayed because the fog was heavy.", th: "เที่ยวบินล่าช้าเพราะหมอกหนา", mark: "because" },
        { en: "Despite the high price, the product sold well.", th: "แม้ราคาจะสูง สินค้าก็ขายดี", mark: "Despite" },
        {
          en: "Although the price was high, the product sold well.",
          th: "แม้ราคาจะสูง สินค้าก็ขายดี",
          mark: "Although",
        },
      ],
      tip: "ห้ามใช้ despite of ที่ถูกคือ despite หรือ in spite of",
      drills: [
        {
          sentence: "___ the bad weather, the outdoor event went ahead as planned.",
          options: ["Despite", "Although", "Because", "Even though"],
          answer: "Despite",
          why: "หลังช่องว่างเป็นวลีนาม (the bad weather) และความหมายขัดแย้งกัน ใช้ Despite",
        },
        {
          sentence: "The shipment arrived late ___ a problem at the port.",
          options: ["due to", "because", "although", "despite"],
          answer: "due to",
          why: "หลังช่องว่างเป็นวลีนาม (a problem) และบอกสาเหตุ ใช้ due to",
        },
        {
          sentence: "___ sales fell last year, the company hired more staff.",
          options: ["Although", "Despite", "In spite of", "Because of"],
          answer: "Although",
          why: "หลังช่องว่างเป็นประโยค (sales fell) และความหมายขัดแย้งกัน ใช้คำเชื่อม Although",
        },
        {
          sentence: "The meeting was postponed ___ the director was ill.",
          options: ["because", "because of", "due to", "despite"],
          answer: "because",
          why: "หลังช่องว่างเป็นประโยค (the director was ill) ใช้คำเชื่อม because",
        },
      ],
    },
    {
      id: "collocations",
      title: "คำที่มากับบุพบทเฉพาะ",
      intro:
        "คำหลายคำต้องมากับบุพบทตัวเดิมเสมอ เดาจากความหมายไม่ได้ จึงต้องจำเป็นคู่ ด้านล่างคือคู่ที่เจอบ่อยในข้อสอบและเอกสารธุรกิจ",
      rules: [
        { word: "responsible for", use: "รับผิดชอบ", examples: "responsible for training staff" },
        { word: "in charge of", use: "ดูแล รับผิดชอบ", examples: "in charge of the project" },
        { word: "comply with", use: "ปฏิบัติตาม", examples: "comply with the regulations" },
        { word: "depend on / rely on", use: "ขึ้นอยู่กับ พึ่งพา", examples: "depend on the weather" },
        { word: "apply for", use: "สมัคร (ตำแหน่ง ทุน)", examples: "apply for a position" },
        { word: "eligible for", use: "มีสิทธิ์ได้รับ", examples: "eligible for a discount" },
        { word: "according to", use: "ตามที่ระบุใน", examples: "according to the report" },
        { word: "on behalf of", use: "ในนามของ", examples: "on behalf of the company" },
        { word: "in addition to", use: "นอกจาก...แล้ว", examples: "in addition to the salary" },
        { word: "prior to", use: "ก่อน (ทางการ)", examples: "prior to the meeting" },
      ],
      examples: [
        {
          en: "Ms. Chen is responsible for training new employees.",
          th: "คุณเฉินรับผิดชอบการฝึกอบรมพนักงานใหม่",
          mark: "responsible for",
        },
        {
          en: "All visitors must comply with the safety rules.",
          th: "ผู้มาเยือนทุกคนต้องปฏิบัติตามกฎความปลอดภัย",
          mark: "comply with",
        },
        {
          en: "Employees are eligible for a discount after six months.",
          th: "พนักงานมีสิทธิ์ได้ส่วนลดหลังทำงานครบหกเดือน",
          mark: "eligible for",
        },
        {
          en: "Please arrive 15 minutes prior to your appointment.",
          th: "กรุณามาถึงก่อนเวลานัด 15 นาที",
          mark: "prior to",
        },
      ],
      tip: "prior to และ in addition to ตามด้วยคำนามหรือ V-ing เช่น prior to signing (ไม่ใช่ prior to sign)",
      drills: [
        {
          sentence: "Ms. Chen is responsible ___ training new employees.",
          options: ["for", "of", "to", "with"],
          answer: "for",
          why: "responsible ใช้คู่กับ for",
        },
        {
          sentence: "All staff must comply ___ the safety regulations.",
          options: ["with", "to", "for", "on"],
          answer: "with",
          why: "comply ใช้คู่กับ with",
        },
        {
          sentence: "___ the forecast, it will rain tomorrow.",
          options: ["According to", "In addition to", "Prior to", "On behalf of"],
          answer: "According to",
          why: "ตามที่พยากรณ์อากาศบอก ใช้ According to",
        },
        {
          sentence: "I am writing ___ behalf of the hiring committee.",
          options: ["on", "in", "at", "for"],
          answer: "on",
          why: "สำนวนคือ on behalf of (ในนามของ)",
        },
        {
          sentence: "Please arrive 15 minutes ___ to your appointment.",
          options: ["prior", "before", "early", "ahead"],
          answer: "prior",
          why: "ตามด้วย to จึงต้องเป็น prior to (before ไม่ต้องมี to)",
        },
        {
          sentence: "The success of the project depends ___ teamwork.",
          options: ["on", "in", "at", "with"],
          answer: "on",
          why: "depend ใช้คู่กับ on",
        },
      ],
    },
  ],
};
