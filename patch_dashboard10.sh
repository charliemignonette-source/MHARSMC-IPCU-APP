sed -i '/<div className="flex-1 p-4 overflow-y-auto space-y-3 custom-scrollbar">/,/<\/div>/c\
                  <div className="flex-1 p-4 overflow-y-auto space-y-6 custom-scrollbar">\
                    {stats.pendingReports.length === 0 ? (\
                      <p className="text-center text-sm font-bold text-slate-500 py-8">No pending verifications found.</p>\
                    ) : (\
                      <div className="space-y-6">\
                        {['"'"'BUNDLE'"'"', '"'"'AUDIT'"'"', '"'"'HAI'"'"', '"'"'AMS'"'"', '"'"'NSI'"'"', '"'"'OUTBREAK'"'"'].map(type => {\
                          const groupReports = stats.pendingReports.filter((r: any) => r.__type === type);\
                          if (groupReports.length === 0) return null;\
                          return (\
                            <div key={type} className="space-y-3">\
                              <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 pb-2 border-b border-slate-200">{type} REPORTS ({groupReports.length})</h4>\
                              {groupReports.map((report: any, idx: number) => (\
                                <div key={`${report.id || Math.random()}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200">\
                                  <div className="flex items-center gap-4">\
                                    <div className={cn(\
                                      "w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs",\
                                      report.__type === '"'"'AUDIT'"'"' ? '"'"'bg-amber-500'"'"' :\
                                      report.__type === '"'"'BUNDLE'"'"' ? '"'"'bg-indigo-500'"'"' :\
                                      report.__type === '"'"'HAI'"'"' ? '"'"'bg-rose-500'"'"' :\
                                      report.__type === '"'"'AMS'"'"' ? '"'"'bg-teal-500'"'"' :\
                                      report.__type === '"'"'NSI'"'"' ? '"'"'bg-orange-500'"'"' : '"'"'bg-slate-500'"'"'\
                                    )}>\
                                      {report.__type?.[0]}\
                                    </div>\
                                    <div>\
                                      <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">{report.__type} REPORT • {report.unit || report.incident?.unit || '"'"'GEN'"'"'}</p>\
                                      <p className="text-[10px] font-medium text-slate-500 italic">By {report.auditorName || report.staffName || report.prescriberName || report.reporterName || report.reportedBy || report.reporterEmail || '"'"'Staff Member'"'"'}</p>\
                                    </div>\
                                  </div>\
                                  <div className="flex items-center gap-4">\
                                    <div className="text-right">\
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDate(report.__date)}</p>\
                                      <div className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg inline-block mt-1 bg-amber-100 text-amber-700">\
                                        PENDING\
                                      </div>\
                                    </div>\
                                    <button onClick={() => { setShowPendingModal(false); onNavigate && onNavigate(report.__type === '"'"'BUNDLE'"'"' ? '"'"'hai'"'"' : report.__type.toLowerCase()); }} className="p-2 bg-white shadow-sm border border-slate-200 rounded-xl hover:border-brand-primary hover:text-brand-primary transition-colors">\
                                      <ArrowDownRight className="w-4 h-4 -rotate-90" />\
                                    </button>\
                                  </div>\
                                </div>\
                              ))}\
                            </div>\
                          );\
                        })}\
                      </div>\
                    )}\
                  </div>\
' src/components/Dashboard.tsx
