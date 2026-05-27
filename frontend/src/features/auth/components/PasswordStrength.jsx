// src/features/auth/components/PasswordStrength.jsx
import { scorePassword } from "../utils/passwordStrength";

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
