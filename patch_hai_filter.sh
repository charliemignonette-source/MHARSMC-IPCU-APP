sed -i '1118c\
                      {bundleLogs.filter(l => {\
                        if (!isIPCU && l.isValidated) return false;\
                        if (bundleValidationFilter === '"'"'Verified'"'"') return l.isValidated;\
                        if (bundleValidationFilter === '"'"'Pending Validation'"'"') return !l.isValidated;\
                        return true;\
                      }).map(log => (\
' src/components/HAI.tsx
