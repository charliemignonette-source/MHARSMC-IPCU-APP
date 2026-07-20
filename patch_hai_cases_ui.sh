sed -i '835,850c\
              <div className="flex flex-col gap-4">\
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">\
                  <div className="flex items-center gap-3">\
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">HAI Case Surveillance Register</h3>\
                    <div className="h-px w-12 bg-slate-200 hidden sm:block" />\
                  </div>\
                  <div className="flex items-center gap-2">\
                    <div className="flex bg-slate-100 p-1 rounded-xl">\
                      <div className="px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500">\
                        Total ({cases.length})\
                      </div>\
                    </div>\
                    <button onClick={handleDownloadHAICasesCSV} className="px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 text-[9px] font-black uppercase tracking-widest text-slate-600 rounded-xl transition-all flex items-center gap-2">\
                      <FileDown className="w-3.5 h-3.5" /> CSV\
                    </button>\
                  </div>\
                </div>\
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">\
                  {['"'"'All'"'"', '"'"'Pending Validation'"'"', '"'"'Verified'"'"'].map(status => (\
                    <button\
                      key={status}\
                      onClick={() => setCaseValidationFilter(status as any)}\
                      className={cn(\
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",\
                        caseValidationFilter === status \
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
