import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('Tadbeera ErrorBoundary caught an error:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="m-3 rounded-2xl border border-[#F3DCE2] bg-[#FFFFFF] p-5 text-center shadow-sm space-y-3"
          role="alert"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FADDE4] text-[#C96D84]">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-black text-[#4A353B]">
              {this.props.fallbackTitle || 'حصل خطأ غير متوقع في عرض الشاشة'}
            </h2>
            <p className="text-xs leading-5 text-[#8E757C]">
              بياناتك محفوظة بأمان على جهازك. تقدر تعيد المحاولة دلوقتي أو تحدث الصفحة.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#D47E93] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#C96D84]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>إعادة المحاولة</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-[40px] items-center rounded-xl border border-[#F3DCE2] bg-[#FFF8FA] px-4 py-2 text-xs font-bold text-[#C96D84] transition hover:bg-[#FADDE4]"
            >
              تحديث التطبيق
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
