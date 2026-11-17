import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 bg-[#FADDE4] hover:bg-[#E8A8B7] text-[#C96D84] border border-[#F3DCE2] font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-xs transition"
        title="تثبيت التطبيق على جهازك كـ PWA"
      >
        <Download className="w-3.5 h-3.5" />
        <span>تثبيت التطبيق 📲</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 bg-[#FADDE4] hover:bg-[#E8A8B7] text-[#C96D84] border border-[#F3DCE2] font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-xs transition"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>تثبيت على آيفون 📱</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl bg-[#FFFFFF] p-5 shadow-2xl border border-[#F3DCE2] text-right">
              <div className="flex items-center justify-between mb-3 border-b border-[#F3DCE2] pb-2">
                <h3 className="text-sm font-extrabold text-[#4A353B] flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#C96D84]" />
                  <span>تثبيت تدبيرة على آيفون / آيباد</span>
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-[#8E757C] hover:text-[#4A353B] rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-[#4A353B] leading-relaxed">
                <p className="font-bold text-[#4A353B]">لتثبيت التطبيق على شاشة هاتف الآيفون بسهولة:</p>
                <ol className="list-decimal list-inside space-y-1.5 bg-[#FFF8FA] p-3 rounded-xl border border-[#F3DCE2]">
                  <li>اضغط على زر <strong className="text-[#C96D84]">مشاركة (Share)</strong> 📤 في أسفل شريط متصفح Safari.</li>
                  <li>انزل لأسفل واختر <strong className="text-[#C96D84]">إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong> 📲.</li>
                  <li>اضغط <strong className="text-[#C96D84]">إضافة (Add)</strong> أعلى الشاشة.</li>
                </ol>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-[#D47E93] py-2 text-xs font-bold text-white hover:bg-[#C96D84] transition"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
