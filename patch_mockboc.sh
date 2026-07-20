sed -i '/staffId: data.staffId || '\'''\''/c\
               staffId: data.staffId || '\'''\'',\n               isValidated: day.isVerifiedByIPCU === true,\n               status: day.isVerifiedByIPCU ? "VALIDATED" : "PENDING"\
' src/components/Dashboard.tsx
