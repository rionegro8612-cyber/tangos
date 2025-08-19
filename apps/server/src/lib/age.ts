export function calcAgeFromBirthYYYYMMDD(birth: string, now = new Date()): number {
    if (!/^\d{8}$/.test(birth)) return -1;
    const y = Number(birth.slice(0,4));
    const m = Number(birth.slice(4,6));
    const d = Number(birth.slice(6,8));
    const dob = new Date(Date.UTC(y, m - 1, d));
    let age = now.getUTCFullYear() - dob.getUTCFullYear();
    const mo = now.getUTCMonth() - dob.getUTCMonth();
    if (mo < 0 || (mo === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
    return age;
  }
  