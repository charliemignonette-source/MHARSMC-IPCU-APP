sed -i '/<\/AnimatePresence>/i \
      {selectedAuditForValidation && (\n        <AuditValidationModal \n          audit={selectedAuditForValidation} \n          onClose={() => setSelectedAuditForValidation(null)} \n          onSubmit={handleValidateSubmit} \n          user={user} \n        />\n      )}' src/components/Audits.tsx
