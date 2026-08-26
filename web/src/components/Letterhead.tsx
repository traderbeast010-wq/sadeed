import type { Office } from "@/lib/types";

/**
 * ترويسة المكتب في الوثائق الرسمية (العقد المصحَّح، الفاتورة).
 * تُسحَب من إعدادات المكتب — إن لم تُملأ بعد لا يظهر شيء.
 */
export function Letterhead({ office }: { office: Office | null }) {
  if (!office) return null;
  const has =
    office.office_name ||
    office.lawyer_name ||
    office.logo ||
    office.license_no;
  if (!has) return null;

  return (
    <div className="flex items-start justify-between gap-4 pb-4 mb-6 border-b border-black/25">
      <div>
        {office.office_name && (
          <p className="text-[15px] font-bold text-black">
            {office.office_name}
          </p>
        )}
        {office.lawyer_name && (
          <p className="text-[11.5px] text-[#333] mt-0.5">
            {office.lawyer_name}
            {office.license_no && (
              <span className="text-[#666]"> · ترخيص {office.license_no}</span>
            )}
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-[#666]">
          {office.phone && <span className="tnum">{office.phone}</span>}
          {office.email && <span>{office.email}</span>}
          {office.address && <span>{office.address}</span>}
        </div>
      </div>
      {office.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={office.logo}
          alt=""
          className="w-16 h-16 object-contain shrink-0"
        />
      )}
    </div>
  );
}
