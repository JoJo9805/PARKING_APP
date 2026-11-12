import React from "react";
import { X, AlertTriangle, CheckCircle, Info } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  isDestructive = false,
  onConfirm,
  onClose,
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
        <div className="flex items-start space-x-4">
          <div
            className={`p-3 rounded-xl flex-shrink-0 ${
              isDestructive ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
            }`}
          >
            {isDestructive ? <AlertTriangle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow transition flex items-center space-x-2 ${
              isDestructive
                ? "bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
                : "bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            }`}
          >
            {isLoading ? <span>Đang xử lý...</span> : <span>{confirmText}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ImageLightboxProps {
  isOpen: boolean;
  imageUrl?: string | null;
  cropUrl?: string | null;
  title: string;
  onClose: () => void;
}

export function ImageLightbox({ isOpen, imageUrl, cropUrl, title, onClose }: ImageLightboxProps) {
  if (!isOpen || (!imageUrl && !cropUrl)) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative bg-slate-900 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-800 text-white flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 className="font-bold text-lg">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {imageUrl && (
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Ảnh toàn cảnh (Camera AI)</p>
              <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center min-h-[240px]">
                <img src={imageUrl} alt="Ảnh toàn cảnh" className="max-h-[50vh] w-auto object-contain" />
              </div>
            </div>
          )}

          {cropUrl && (
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Ảnh nhận diện biển số (Crop)</p>
              <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 p-2 flex items-center justify-center">
                <img src={cropUrl} alt="Crop biển số" className="max-h-[120px] w-auto object-contain" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

