sed -i '2335,2336c\
        )}\n      </AnimatePresence>\n      {selectedAuditForValidation && (\n        <AuditValidationModal\n          audit={selectedAuditForValidation}\n          onClose={() => setSelectedAuditForValidation(null)}\n          onSubmit={handleValidateSubmit}\n          user={user}\n        />\n      )}\n    </div>\n  );\n}' src/components/Audits.tsx
