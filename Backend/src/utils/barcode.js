/**
 * Generates a standard student barcode/QR string.
 * Example: '23BCE1234' -> 'VW-STU-23BCE1234'
 * @param {string} studentId
 * @returns {string}
 */
export const generateStudentBarcode = (studentId) => {
  const sanitized = String(studentId).trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `VW-STU-${sanitized}`;
};

/**
 * Validates whether a barcode string conforms to the expected format.
 * @param {string} barcode
 * @returns {boolean}
 */
export const isValidStudentBarcode = (barcode) => {
  if (typeof barcode !== "string") return false;
  return /^VW-STU-[A-Z0-9]{3,}$/i.test(barcode.trim());
};

export default { generateStudentBarcode, isValidStudentBarcode };
