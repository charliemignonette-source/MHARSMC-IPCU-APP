sed -i '1064,1077c\
              ) : (() => {\
                const filteredAudits = audits.filter(a => {\
                  const s = searchTerm.toLowerCase();\
                  const searchMatch = (\
                    (a.unit?.toLowerCase().includes(s)) ||\
                    (a.auditorName?.toLowerCase().includes(s)) ||\
                    (a.type?.toLowerCase().includes(s)) ||\
                    (a.staffIdentifier?.toLowerCase().includes(s)) ||\
                    (a.profession?.toLowerCase().includes(s))\
                  );\
                  if (!searchMatch) return false;\
                  if (validationFilter === '"'"'Verified'"'"') return a.isValidated;\
                  if (validationFilter === '"'"'Pending Validation'"'"') return !a.isValidated;\
                  return true;\
                });\
' src/components/Audits.tsx
