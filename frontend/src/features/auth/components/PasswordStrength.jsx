// src/features/auth/components/PasswordStrength.jsx
export function scorePassword(pw){
  let s=0;
  if(pw.length>=8)s++;
  if(/[A-Z]/.test(pw))s++;
  if(/[a-z]/.test(pw))s++;
  if(/\d/.test(pw))s++;
  if(/[^A-Za-z0-9]/.test(pw))s++;
  return s; // 0..5
}

export default function PasswordStrength({ value="" }){
  const s = scorePassword(value);
  const label = s<=2 ? "débil" : s===3 ? "media" : "fuerte";
  return (
    <>
      {value ? <div className="small">Fortaleza: {label}</div> : null}
      <div className="strength">
        {[1,2,3,4,5].map(i => (
          <div key={i} className={s>=i ? `on-${i}` : ""}/>
        ))}
      </div>
    </>
  );
}
