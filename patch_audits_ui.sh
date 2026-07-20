sed -i '1021,1040c\
          <div className="col-span-full bento-card bg-white min-h-[400px] flex flex-col">\
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col gap-4">\
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">\
                <div className="flex items-center gap-3">\
                  <Search className="w-4 h-4 text-slate-400" />\
                  <input \
                    placeholder="Search unit, auditor, or type..."\
                    value={searchTerm}\
                    onChange={e => setSearchTerm(e.target.value)}\
                    className="bg-transparent border-none text-[11px] font-black uppercase tracking-widest text-slate-600 w-full sm:w-64 outline-none placeholder:text-slate-300"\
                  />\
                </div>\
                <div className="flex gap-2">\
                  <button className="p-1.5 sm:p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">\
                    <Filter className="w-3.5 h-3.5" />\
                  </button>\
                  <button className="p-1.5 sm:p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">\
                    <Calendar className="w-3.5 h-3.5" />\
                  </button>\
                </div>\
              </div>\
              <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">\
                {['"'"'All'"'"', '"'"'Pending Validation'"'"', '"'"'Verified'"'"'].map(status => (\
                  <button\
                    key={status}\
                    onClick={() => setValidationFilter(status as any)}\
                    className={cn(\
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",\
                      validationFilter === status \
                        ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20" \
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"\
                    )}\
                  >\
                    {status}\
                  </button>\
                ))}\
              </div>\
            </div>\
' src/components/Audits.tsx
