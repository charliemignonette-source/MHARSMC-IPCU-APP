sed -i '887,984c\
                      {Object.values(\
                        cases\
                          .filter(c => {\
                            const isVerified = c.status === '"'"'CONFIRMED'"'"' || c.status === '"'"'REJECTED'"'"';\
                            if (caseValidationFilter === '"'"'Verified'"'"') return isVerified;\
                            if (caseValidationFilter === '"'"'Pending Validation'"'"') return !isVerified;\
                            return true;\
                          })\
                          .reduce((acc, c) => {\
                            const key = c.hospNo || c.patientName;\
                            if (!acc[key]) acc[key] = [];\
                            acc[key].push(c);\
                            return acc;\
                          }, {} as Record<string, any[]>)\
                      ).map((group, gIdx) => (\
                        <React.Fragment key={group[0].hospNo || gIdx}>\
                          {group.map((c, idx) => (\
                            <tr key={c.id} className={cn("hover:bg-slate-50/50 transition-colors group", idx > 0 ? "border-t border-slate-50" : "")}>\
                              {idx === 0 && (\
                                <td className="px-6 py-4 align-top" rowSpan={group.length}>\
                                  <div className="flex flex-col">\
                                    <span className="text-xs font-bold text-slate-900">{c.patientName}</span>\
                                    <div className="flex items-center gap-2 mt-0.5">\
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{c.unit}</span>\
                                      <span className="text-[8px] font-mono text-slate-300">#{c.hospNo}</span>\
                                    </div>\
                                  </div>\
                                </td>\
                              )}\
                              <td className="px-6 py-4 align-top">\
                                <span className="text-xs font-medium text-slate-600">{c.deviceType || c.procedureType}</span>\
                              </td>\
                              <td className="px-6 py-4 align-top">\
                                {c.status === '"'"'PENDING'"'"' ? (\
                                  <div className="flex flex-wrap gap-1">\
                                    {c.triggeredCriteria?.map((cr: string) => <span key={cr} className="px-1.5 py-0.5 bg-slate-100 text-[8px] font-bold uppercase rounded">{cr}</span>)}\
                                    {c.triggeredLabs?.map((l: string) => <span key={l} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 [font-size:8px] font-black uppercase rounded">{l}</span>)}\
                                    {c.manualFlag && (\
                                      <span className="px-1.5 py-0.5 bg-rose-500 text-white [font-size:8px] font-black uppercase rounded shadow-sm">Flagged</span>\
                                    )}\
                                  </div>\
                                ) : (\
                                  <div className="flex flex-col gap-1">\
                                    <div className="flex items-center gap-2">\
                                      <span className={cn(\
                                        "px-1.5 py-0.5 text-[8px] font-black uppercase rounded",\
                                        c.status === '"'"'CONFIRMED'"'"' ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-600"\
                                      )}>\
                                        {c.status}\
                                      </span>\
                                      {c.decisionNote && <span className="text-[9px] text-slate-500 line-clamp-1 italic">"{c.decisionNote}"</span>}\
                                    </div>\
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Validated on: {(c.validatedAt && typeof (c.validatedAt as any).toDate === '"'"'function'"'"') ? (c.validatedAt as any).toDate().toLocaleDateString() : (c.validatedAt && !isNaN(new Date(c.validatedAt).getTime()) ? new Date(c.validatedAt).toLocaleDateString() : '"'"'N/A'"'"')}</span>\
                                  </div>\
                                )}\
                              </td>\
                              <td className="px-6 py-4 align-top">\
                                <span className="text-xs font-black text-rose-500 uppercase italic">{c.type}</span>\
                              </td>\
                              <td className="px-6 py-4 align-top">\
                                <div className="flex items-center gap-2">\
                                  <span className={cn(\
                                    "w-3 h-3 rounded-full block shadow-sm",\
                                    c.riskLevel === '"'"'RED'"'"' ? "bg-rose-500" : c.riskLevel === '"'"'YELLOW'"'"' ? "bg-amber-400" : c.riskLevel === '"'"'BLUE'"'"' ? "bg-blue-500" : "bg-slate-900"\
                                  )} />\
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{c.riskLevel === '"'"'RED'"'"' ? '"'"'HIGH'"'"' : c.riskLevel === '"'"'YELLOW'"'"' ? '"'"'MODERATE'"'"' : c.riskLevel === '"'"'BLUE'"'"' ? '"'"'LOW'"'"' : c.riskLevel}</span>\
                                </div>\
                              </td>\
                              <td className="px-6 py-4 text-right align-top">\
                                <div className="flex items-center justify-end gap-2">\
                                  {isIPCU && (\
                                    <button \
                                      onClick={(e) => handleDelete(e, '"'"'hai_cases'"'"', c.id)}\
                                      className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100/50"\
                                      title="Delete Entry"\
                                    >\
                                      <Trash2 className="w-4 h-4" />\
                                    </button>\
                                  )}\
                                  <div className="flex items-center gap-1">\
                                    <button \
                                      onClick={() => downloadCasePDF(c)}\
                                      className="p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-500 rounded-lg transition-colors"\
                                      title="Download PDF Report"\
                                    >\
                                      <FileDown className="w-4 h-4" />\
                                    </button>\
                                    {isIPCU && c.status === '"'"'PENDING'"'"' ? (\
                                      <button \
                                        onClick={() => { setSelectedCase(c); setIsValidating(true); }}\
                                        className="text-[9px] font-black uppercase tracking-widest text-brand-primary p-2 hover:bg-teal-50 rounded-lg transition-colors border border-transparent hover:border-teal-100"\
                                      >\
                                        Validate\
                                      </button>\
                                    ) : (\
                                      <button \
                                        onClick={() => { setSelectedCase(c); setIsValidating(true); }}\
                                        className="text-[9px] font-black uppercase tracking-widest text-slate-400 p-2 hover:bg-slate-100 rounded-lg"\
                                      >\
                                        View\
                                      </button>\
                                    )}\
                                  </div>\
                                </div>\
                              </td>\
                            </tr>\
                          ))}\
                        </React.Fragment>\
                      ))}\
' src/components/HAI.tsx
