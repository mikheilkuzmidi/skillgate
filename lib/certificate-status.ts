import type { CertificateView, CertificateTypeView, EmployeeView } from "./use-skillgate";

export function certificateStatus(
  cert: CertificateView,
  type: CertificateTypeView | undefined,
  employee: EmployeeView | undefined,
  now: number
) {
  const label = cert.revoked ? "Revoked"
    : BigInt(now) >= cert.expiresAt ? "Expired"
    : !type?.active ? "Inactive"
    : !employee ? "Not registered"
    : employee.role !== type.role ? "Role changed"
    : "Active";
  return { ok: label === "Active", label };
}
