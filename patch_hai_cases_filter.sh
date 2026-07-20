sed -i '888,889c\
                      {cases\
                        .filter(c => {\
                          const isVerified = c.status === '"'"'CONFIRMED'"'"' || c.status === '"'"'REJECTED'"'"';\
                          if (caseValidationFilter === '"'"'Verified'"'"') return isVerified;\
                          if (caseValidationFilter === '"'"'Pending Validation'"'"') return !isVerified;\
                          return true;\
                        })\
                        .map(c => (\
' src/components/HAI.tsx
