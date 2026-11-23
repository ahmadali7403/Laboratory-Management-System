// Starter catalog. Parameter: [name, unit, low, high, textRange]. Ranges are adult defaults and editable.
const P = (name, unit = null, refLow = null, refHigh = null, refRangeText = null) => ({ name, unit, refLow, refHigh, refRangeText });
const NEG = "Negative";
const T = (code, name, category, price, params, sampleType = "Blood", turnaroundHours = 6) => ({ code, name, category, price, sampleType, turnaroundHours, parameters: params });

export const DEFAULT_TESTS = [
  T("CBC", "Complete Blood Count (CBC)", "Hematology", 500, [
    P("WBC COUNT (TLC)", "x10^9/L", 4.0, 11.3), P("RBC", "10^6/uL", 4.25, 6.02), P("HB (HEMOGLOBIN)", "g/dL", 12.3, 16.6),
    P("HCT", "%", 35, 45), P("MCV", "fL", 78, 96), P("MCH", "pg", 25.1, 31.6), P("MCHC", "g/dL", 30, 36),
    P("Platelet Count", "x10^9/L", 150, 450), P("Neutrophils", "%", 40, 75), P("Lymphocytes", "%", 20, 50),
    P("Monocytes", "%", 2, 10), P("Eosinophils", "%", 1, 6),
  ], "Blood", 4),
  T("LFT", "Liver Function Tests (LFT)", "Biochemistry", 900, [
    P("BILIRUBIN TOTAL", "mg/dL", 0.2, 1.2), P("S.G.P.T (A.L.T)", "U/L", 5, 41), P("S.G.O.T (A.S.T)", "U/L", 5, 40),
    P("ALKALINE PHOSPHATASE", "U/L", 47, 480), P("PROTEIN (SERUM)", "g/dL", 6.0, 8.6), P("ALBUMIN (SERUM)", "g/dL", 3.2, 4.5),
    P("Globulins", "g/dL", 2.5, 3.5), P("A/G Ratio", null, 1.1, 2.4),
  ]),
  T("RFT", "Renal Function Tests (RFT)", "Biochemistry", 800, [P("UREA (SERUM)", "mg/dL", 10, 50), P("CREATININE (SERUM)", "mg/dL", 0.7, 1.3), P("BUN", "mg/dL", 2.5, 18)]),
  T("ELEC", "Serum Electrolytes", "Biochemistry", 700, [P("SODIUM", "mmol/L", 135, 150), P("POTASSIUM (SERUM)", "mmol/L", 3.5, 5.3), P("CHLORIDE (SERUM)", "mmol/L", 98, 112)]),
  T("LIPID", "Lipid Profile", "Biochemistry", 1200, [
    P("CHOLESTEROL TOTAL", "mg/dL", 0, 200), P("TRIGLYCERIDES", "mg/dL", 0, 150), P("HDL CHOLESTEROL", "mg/dL", 40, 100),
    P("LDL CHOLESTEROL", "mg/dL", 0, 130), P("VLDL CHOLESTEROL", "mg/dL", 5, 40), P("CHOL/HDL RATIO", null, 0, 5),
  ]),
  T("HBA1C", "HbA1c (Glycosylated Hemoglobin)", "Biochemistry", 1000, [P("HbA1c", "%", 4.0, 5.6), P("ESTIMATED AVERAGE GLUCOSE", "mg/dL", 68, 114)], "Blood", 8),
  T("FBS", "Blood Glucose Fasting", "Biochemistry", 200, [P("GLUCOSE FASTING", "mg/dL", 70, 100)], "Blood", 2),
  T("RBS", "Blood Glucose Random", "Biochemistry", 200, [P("GLUCOSE RANDOM", "mg/dL", 70, 140)], "Blood", 2),
  T("URDR", "Urine Complete Examination (D/R)", "Clinical Pathology", 300, [
    P("COLOR", null, null, null, "Pale Yellow"), P("APPEARANCE", null, null, null, "Clear"), P("pH", null, 4.5, 8.0),
    P("SPECIFIC GRAVITY", null, 1.005, 1.030), P("PROTEIN", null, null, null, NEG), P("GLUCOSE", null, null, null, NEG),
    P("KETONES", null, null, null, NEG), P("BLOOD", null, null, null, NEG), P("BILIRUBIN", null, null, null, NEG),
    P("UROBILINOGEN", null, null, null, "Normal"), P("NITRITE", null, null, null, NEG), P("LEUKOCYTE ESTERASE", null, null, null, NEG),
    P("PUS CELLS", "/HPF", 0, 5), P("RED BLOOD CELLS", "/HPF", 0, 2), P("EPITHELIAL CELLS", "/HPF", null, null, "Occasional"),
    P("CASTS", null, null, null, "Nil"), P("CRYSTALS", null, null, null, "Nil"), P("BACTERIA", null, null, null, "Nil"),
  ], "Urine", 3),
  T("TFT", "Thyroid Profile (T3, T4, TSH)", "Hormones", 1500, [P("T3 (TRI-IODOTHYRONINE)", "ng/mL", 0.8, 2.0), P("T4 (THYROXINE)", "ug/dL", 5.1, 14.1), P("TSH", "uIU/mL", 0.27, 4.2)], "Blood", 12),
  T("INFECT", "Infectious Profile (HIV, HBsAg, HCV)", "Serology", 1200, [P("ANTI HIV (SCREENING)", null, null, null, NEG), P("HBsAg (SCREENING)", null, null, null, NEG), P("ANTI HCV (SCREENING)", null, null, null, NEG)], "Blood", 4),
  T("TYPHIDOT", "Typhidot (IgM / IgG)", "Serology", 800, [P("TYPHIDOT IgM", null, null, null, NEG), P("TYPHIDOT IgG", null, null, null, NEG)], "Blood", 6),
  T("WIDAL", "Widal Test", "Serology", 500, [P("S. TYPHI O", null, null, null, "< 1:80"), P("S. TYPHI H", null, null, null, "< 1:80"), P("S. PARATYPHI AH", null, null, null, "< 1:80"), P("S. PARATYPHI BH", null, null, null, "< 1:80")], "Blood", 6),
  T("MP", "Malaria Parasite (MP)", "Hematology", 300, [P("MALARIA PARASITE", null, null, null, "Not Seen")], "Blood", 2),
  T("DENGUE", "Dengue Profile (NS1, IgM, IgG)", "Serology", 2000, [P("DENGUE NS1 ANTIGEN", null, null, null, NEG), P("DENGUE IgM", null, null, null, NEG), P("DENGUE IgG", null, null, null, NEG)], "Blood", 6),
  T("ESR", "ESR", "Hematology", 200, [P("ESR (1st HOUR)", "mm/hr", 0, 20)], "Blood", 2),
  T("CRP", "C-Reactive Protein (CRP)", "Biochemistry", 600, [P("CRP", "mg/L", 0, 6)], "Blood", 4),
  T("CA", "Serum Calcium", "Biochemistry", 400, [P("CALCIUM (SERUM)", "mg/dL", 8.6, 10.2)]),
  T("URIC", "Uric Acid", "Biochemistry", 400, [P("URIC ACID (SERUM)", "mg/dL", 3.5, 7.2)]),
  T("VITD", "Vitamin D (25-OH)", "Hormones", 3000, [P("VITAMIN D (25-OH)", "ng/mL", 30, 100)], "Blood", 24),
  T("B12", "Vitamin B12", "Hormones", 2500, [P("VITAMIN B12", "pg/mL", 211, 911)], "Blood", 24),
  T("IRON", "Iron Profile", "Biochemistry", 2200, [P("SERUM IRON", "ug/dL", 60, 170), P("TIBC", "ug/dL", 250, 450), P("TRANSFERRIN SATURATION", "%", 20, 50), P("FERRITIN", "ng/mL", 24, 336)], "Blood", 12),
  T("PTINR", "PT / INR", "Hematology", 900, [P("PROTHROMBIN TIME (PT)", "sec", 11, 13.5), P("CONTROL", "sec", null, null), P("INR", null, 0.8, 1.2)], "Blood", 4),
  T("BGRH", "Blood Group & Rh Factor", "Hematology", 300, [P("ABO BLOOD GROUP"), P("RH FACTOR")], "Blood", 2),
  T("STOOL", "Stool Complete Examination (D/R)", "Clinical Pathology", 300, [
    P("COLOR"), P("CONSISTENCY"), P("MUCUS", null, null, null, "Absent"), P("BLOOD", null, null, null, "Absent"),
    P("PUS CELLS", "/HPF", 0, 5), P("RED BLOOD CELLS", "/HPF", null, null, "Nil"), P("OVA / PARASITES", null, null, null, "Not Seen"), P("CYSTS", null, null, null, "Not Seen"),
  ], "Stool", 3),
];
