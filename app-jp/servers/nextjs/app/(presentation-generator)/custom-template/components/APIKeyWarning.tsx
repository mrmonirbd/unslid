import React from "react";
import Header from "@/app/(presentation-generator)/(dashboard)/dashboard/components/Header";

export const APIKeyWarning: React.FC = () => {
  return (
    <div className="min-h-screen font-roboto bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />
      <div className="flex items-center justify-center aspect-video mx-auto px-6">
        <div className="text-center space-y-2 my-6 bg-white p-10 rounded-lg shadow-lg">
          <h1 className="text-xl font-bold text-gray-900">
            AI経由でテンプレートを作成するには「GOOGLE_API_KEY」を追加してください。
          </h1>
          <h1 className="text-xl font-bold text-gray-900">レイアウトを処理するためにOpenAI APIキーを追加してください</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            この機能にはOpenAIのGPT-5モデルが必要です。設定または環境変数でキーを設定してください。
          </p>
        </div>
      </div>
    </div>
  );
}; 