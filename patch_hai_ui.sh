sed -i '1078,1085c\
              <div className="flex flex-col gap-4">\
                <div className="flex items-center gap-3">\
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Pending Unit Audits (BOC Forms)</h3>\
                  <div className="h-px flex-1 bg-slate-200" />\
                  <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">\
                     <AlertTriangle className="w-3 h-3" />\
                     {bundleLogs.filter(l => !l.isValidated).length} Awaiting Verification\
                  </div>\
                </div>\
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">\
                  {['"'"'All'"'"', '"'"'Pending Validation'"'"', '"'"'Verified'"'"'].map(status => (\
                    <button\
                      key={status}\
                      onClick={() => setBundleValidationFilter(status as any)}\
                      className={cn(\
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",\
                        bundleValidationFilter === status \
                          ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20" \
                          : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"\
                      )}\
                    >\
                      {status}\
                    </button>\
                  ))}\
                </div>\
              </div>\
' src/components/HAI.tsx
