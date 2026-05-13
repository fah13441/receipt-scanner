"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ScanLine,
  Upload,
  Loader2,
  Download,
  Save,
  Plus,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle,
  X,
  Receipt,
  ZoomIn,
} from "lucide-react";

const CATEGORIES = [
  "Groceries",
  "Restaurant",
  "Travel",
  "Electronics",
  "Healthcare",
  "Utilities",
  "Entertainment",
  "Other",
];

function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-500 text-slate-950 px-5 py-3 rounded-xl shadow-2xl shadow-emerald-500/30 font-semibold text-sm animate-slide-up">
      <CheckCircle size={18} />
      {message}
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100">
        <X size={15} />
      </button>
    </div>
  );
}

function SkeletonField() {
  return (
    <div className="h-10 bg-slate-800/80 rounded-lg animate-pulse w-full" />
  );
}

function SkeletonRow() {
  return (
    <div className="flex gap-3">
      <div className="h-9 bg-slate-800/80 rounded-lg animate-pulse flex-1" />
      <div className="h-9 bg-slate-800/80 rounded-lg animate-pulse w-28" />
      <div className="w-8 h-9 bg-slate-800/80 rounded-lg animate-pulse" />
    </div>
  );
}

export default function ReceiptScanner() {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [recentScans, setRecentScans] = useState([]);

  const [form, setForm] = useState({
    merchantName: "",
    date: "",
    totalAmount: "",
    currency: "USD",
    category: "Other",
  });
  const [lineItems, setLineItems] = useState([]);

  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("receiptScans") || "[]");
      setRecentScans(saved);
    } catch {}
  }, []);

  const isDateInFuture = () => {
    if (!form.date) return false;
    return new Date(form.date) > new Date();
  };

  const isTotalHighValue = () => {
    const val = parseFloat(form.totalAmount);
    return !isNaN(val) && val > 10000;
  };

  const processFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }

    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setError(null);
    setIsLoading(true);

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType: file.type }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "API error");
      }

      const data = await res.json();
      setForm({
        merchantName: data.merchantName || "",
        date: data.date || "",
        totalAmount:
          data.totalAmount !== undefined ? String(data.totalAmount) : "",
        currency: data.currency || "USD",
        category: data.category || "Other",
      });
      setLineItems(
        (data.lineItems || []).map((item, i) => ({ ...item, id: i }))
      );
    } catch (err) {
      setError(err.message || "Failed to scan receipt. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const updateLineItem = (id, field, value) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: Date.now(), name: "", price: "" },
    ]);
  };

  const removeLineItem = (id) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = () => {
    const entry = {
      ...form,
      lineItems: lineItems.map(({ id, ...rest }) => rest),
      scannedAt: new Date().toISOString(),
      id: Date.now(),
    };
    const updated = [entry, ...recentScans].slice(0, 10);
    setRecentScans(updated);
    localStorage.setItem("receiptScans", JSON.stringify(updated));
    setToast("Data saved!");
  };

  const handleExportCSV = () => {
    const rows = [
      ["Field", "Value"],
      ["Merchant Name", form.merchantName],
      ["Date", form.date],
      ["Total Amount", form.totalAmount],
      ["Currency", form.currency],
      ["Category", form.category],
      [],
      ["Line Items"],
      ["Item Name", "Price"],
      ...lineItems.map((item) => [item.name, item.price]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${form.merchantName || "scan"}-${form.date || Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputBase =
    "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/30 transition-all";
  const warnBorder =
    "border-amber-400/70 focus:border-amber-400 focus:ring-amber-400/30 ring-1 ring-amber-400/20";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
        * { font-family: 'Syne', sans-serif; }
        .mono { font-family: 'DM Mono', monospace; }
        .animate-slide-up {
          animation: slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .zoom-container:hover .zoom-image {
          transform: scale(1.5);
        }
        .zoom-image {
          transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          transform-origin: center center;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .scan-line {
          position: absolute;
          left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #22d3ee, transparent);
          animation: scanAnim 2s ease-in-out infinite;
        }
        @keyframes scanAnim {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .grid-bg {
          background-image: linear-gradient(rgba(148,163,184,0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(148,163,184,0.03) 1px, transparent 1px);
          background-size: 32px 32px;
        }
      `}</style>

      <div className="min-h-screen bg-slate-950 text-slate-200 grid-bg">
        {/* Header */}
        <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Receipt size={14} className="text-slate-950" />
              </div>
              <span className="font-bold text-base tracking-tight text-slate-100">
                Receipt<span className="text-cyan-400">Scanner</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 mono text-xs text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AI-powered extraction
            </div>
          </div>
        </header>

        <main className="max-w-screen-2xl mx-auto px-6 py-6">
          {/* 2-Column Split */}
          <div className="grid grid-cols-2 gap-5 min-h-[calc(100vh-8rem)]">
            {/* ── LEFT: Upload Zone ── */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                  Receipt Image
                </h2>
                {imagePreview && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                  >
                    <Upload size={12} /> Replace
                  </button>
                )}
              </div>

              {!imagePreview ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    flex-1 min-h-[500px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-5
                    cursor-pointer transition-all duration-300 group relative overflow-hidden
                    ${isDragging
                      ? "border-cyan-400 bg-cyan-400/5 scale-[1.01]"
                      : "border-slate-700 hover:border-slate-500 hover:bg-slate-900/40"
                    }
                  `}
                >
                  {isDragging && <div className="scan-line" />}
                  <div
                    className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center transition-all duration-300
                    ${isDragging ? "border-cyan-400 bg-cyan-400/10" : "border-slate-600 group-hover:border-slate-500"}`}
                  >
                    <ScanLine
                      size={28}
                      className={`transition-colors ${isDragging ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-400"}`}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-300 font-semibold text-base mb-1">
                      Drop your receipt here
                    </p>
                    <p className="text-slate-500 text-sm">
                      or click to browse — JPG, PNG, WEBP
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center px-6">
                    {["Photo", "Scan", "Screenshot"].map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 bg-slate-800 rounded-full text-xs text-slate-400 mono"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-[500px] relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 zoom-container cursor-zoom-in group">
                  <img
                    src={imagePreview}
                    alt="Receipt preview"
                    className="w-full h-full object-contain zoom-image"
                  />
                  {isLoading && (
                    <div className="absolute inset-0 bg-slate-950/70 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                      <div className="scan-line" />
                      <Loader2
                        size={32}
                        className="text-cyan-400 animate-spin"
                      />
                      <p className="text-sm text-slate-300 font-medium">
                        Extracting receipt data…
                      </p>
                    </div>
                  )}
                  <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ZoomIn size={12} />
                    Hover to zoom
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
                  <AlertTriangle size={15} className="shrink-0" />
                  {error}
                </div>
              )}
            </div>

            {/* ── RIGHT: Output Form ── */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                  Extracted Data
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCSV}
                    disabled={!form.merchantName && lineItems.length === 0}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
                  >
                    <Download size={12} /> Export CSV
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!form.merchantName}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
                  >
                    <Save size={12} /> Save
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col gap-5 relative">
                {isLoading && (
                  <div className="absolute inset-0 bg-slate-950/60 rounded-2xl z-10 backdrop-blur-[2px]" />
                )}

                {/* Core Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-500 mb-1.5 font-medium tracking-wide">
                      MERCHANT NAME
                    </label>
                    {isLoading ? (
                      <SkeletonField />
                    ) : (
                      <input
                        type="text"
                        value={form.merchantName}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            merchantName: e.target.value,
                          }))
                        }
                        placeholder="e.g. Whole Foods Market"
                        className={inputBase}
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5 font-medium tracking-wide">
                      DATE
                    </label>
                    {isLoading ? (
                      <SkeletonField />
                    ) : (
                      <div className="relative">
                        <input
                          type="date"
                          value={form.date}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, date: e.target.value }))
                          }
                          className={`${inputBase} ${isDateInFuture() ? warnBorder : ""}`}
                        />
                        {isDateInFuture() && (
                          <div className="flex items-center gap-1 mt-1 text-amber-400 text-xs">
                            <AlertTriangle size={11} />
                            Date is in the future
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5 font-medium tracking-wide">
                      CATEGORY
                    </label>
                    {isLoading ? (
                      <SkeletonField />
                    ) : (
                      <select
                        value={form.category}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, category: e.target.value }))
                        }
                        className={`${inputBase} cursor-pointer`}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5 font-medium tracking-wide">
                      TOTAL AMOUNT
                    </label>
                    {isLoading ? (
                      <SkeletonField />
                    ) : (
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={form.totalAmount}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              totalAmount: e.target.value,
                            }))
                          }
                          placeholder="0.00"
                          className={`${inputBase} mono ${isTotalHighValue() ? warnBorder : ""}`}
                        />
                        {isTotalHighValue() && (
                          <div className="flex items-center gap-1 mt-1 text-amber-400 text-xs">
                            <AlertTriangle size={11} />
                            Unusually high amount
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5 font-medium tracking-wide">
                      CURRENCY
                    </label>
                    {isLoading ? (
                      <SkeletonField />
                    ) : (
                      <input
                        type="text"
                        value={form.currency}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, currency: e.target.value }))
                        }
                        placeholder="USD"
                        className={`${inputBase} mono uppercase`}
                        maxLength={5}
                      />
                    )}
                  </div>
                </div>

                {/* Line Items */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-500 font-medium tracking-wide">
                      LINE ITEMS
                    </label>
                    <button
                      onClick={addLineItem}
                      className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <Plus size={12} /> Add row
                    </button>
                  </div>

                  {isLoading ? (
                    <div className="flex flex-col gap-2">
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                      {lineItems.length === 0 ? (
                        <div className="text-center py-6 text-slate-600 text-sm border border-dashed border-slate-800 rounded-xl">
                          No line items extracted yet
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-[1fr_100px_32px] gap-2 px-1">
                            <span className="text-xs text-slate-600 mono">
                              ITEM
                            </span>
                            <span className="text-xs text-slate-600 mono">
                              PRICE
                            </span>
                            <span />
                          </div>
                          {lineItems.map((item) => (
                            <div
                              key={item.id}
                              className="grid grid-cols-[1fr_100px_32px] gap-2 items-center"
                            >
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "name",
                                    e.target.value
                                  )
                                }
                                placeholder="Item name"
                                className={inputBase}
                              />
                              <input
                                type="number"
                                step="0.01"
                                value={item.price}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "price",
                                    e.target.value
                                  )
                                }
                                placeholder="0.00"
                                className={`${inputBase} mono`}
                              />
                              <button
                                onClick={() => removeLineItem(item.id)}
                                className="w-8 h-9 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}

                  {lineItems.length > 0 && !isLoading && (
                    <div className="flex justify-end border-t border-slate-800 pt-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500">Computed total:</span>
                        <span className="mono font-semibold text-cyan-400">
                          {form.currency}{" "}
                          {lineItems
                            .reduce(
                              (sum, item) =>
                                sum + (parseFloat(item.price) || 0),
                              0
                            )
                            .toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Scans */}
          {recentScans.length > 0 && (
            <div className="mt-8 border-t border-slate-800/60 pt-8">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={15} className="text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">
                  Recent Scans
                </h3>
                <span className="ml-auto text-xs text-slate-600 mono">
                  {recentScans.length}/10
                </span>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {recentScans.map((scan) => (
                  <div
                    key={scan.id}
                    className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all cursor-default group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs px-2 py-0.5 bg-slate-800 rounded-full text-slate-400 mono">
                        {scan.category}
                      </span>
                    </div>
                    <p className="font-semibold text-sm text-slate-200 truncate mb-1 group-hover:text-white transition-colors">
                      {scan.merchantName || "Unknown"}
                    </p>
                    <p className="mono text-base font-bold text-cyan-400 mb-2">
                      {scan.currency} {parseFloat(scan.totalAmount || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-600 mono">{scan.date}</p>
                    {scan.lineItems?.length > 0 && (
                      <p className="text-xs text-slate-600 mt-1">
                        {scan.lineItems.length} item
                        {scan.lineItems.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}