import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, X, Search } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

const helpQuestions = [
  {
    id: 1,
    category: "画像",
    question: "画像を変更するにはどうすればよいですか？",
    answer:
      "任意の画像をクリックすると画像ツールバーが表示されます。編集、位置調整、フィット方法の変更などのオプションが表示されます。「編集」オプションで現在の画像を置き換えたり変更したりできます。",
  },
  {
    id: 2,
    category: "画像",
    question: "AIで新しい画像を生成できますか？",
    answer:
      "はい！任意の画像をクリックしてツールバーから「編集」を選択してください。表示されるサイドパネルに「AI生成」タブがあります。欲しい画像を説明するプロンプトを入力すると、AIが画像を生成します。",
  },
  {
    id: 3,
    category: "画像",
    question: "自分の画像をアップロードするにはどうすればよいですか？",
    answer:
      "任意の画像をクリックし、ツールバーから「編集」を選択してください。サイドパネルの上部にある「アップロード」タブをクリックし、ファイルを参照して選択します。アップロード後、デザインに適用できます。",
  },
  {
    id: 11,
    category: "AIプロンプト",
    question: "プロンプトでスライドのレイアウトを変更できますか？",
    answer:
      "はい！各スライドの左上にあるWandSparklesアイコンをクリックするとプロンプト入力ボックスが表示されます。レイアウトの要件を説明すると、AIがスライドのレイアウトを変更します。",
  },
  {
    id: 12,
    category: "AIプロンプト",
    question: "プロンプトでスライドの画像を変更できますか？",
    answer:
      "はい！各スライドの左上にあるWandSparklesアイコンをクリックするとプロンプト入力ボックスが表示されます。欲しい画像を説明すると、AIが要件に基づいてスライドの画像を更新します。",
  },

  {
    id: 14,
    category: "AIプロンプト",
    question: "プロンプトでコンテンツを変更できますか？",
    answer:
      "はい！各スライドの左上にあるWandSparklesアイコンをクリックするとプロンプト入力ボックスが表示されます。欲しいコンテンツを説明すると、AIが説明に基づいてスライドのテキストとコンテンツを更新します。",
  },
  {
    id: 4,
    category: "テキスト",
    question: "テキストの書式設定やハイライトはどうすればできますか？",
    answer:
      "任意のテキストを選択すると書式ツールバーが表示されます。太字、斜体、下線、取り消し線などのオプションが利用できます。",
  },
  {
    id: 5,
    category: "アイコン",
    question: "アイコンを変更するにはどうすればよいですか？",
    answer:
      "既存のアイコンをクリックして変更します。アイコンセレクターパネルでアイコンを閲覧するか、検索機能を使って特定のアイコンを探せます。様々なスタイルの何千ものアイコンをご用意しています。",
  },
  {
    id: 16,
    category: "レイアウト",
    question: "スライドの順番を変えることはできますか？",
    answer:
      "もちろんです。サイドパネルでスライドをドラッグして任意の位置に移動できます。",
  },
  {
    id: 15,
    category: "レイアウト",
    question: "スライドとスライドの間に新しいスライドを追加できますか？",
    answer:
      "はい！各スライドの下にあるプラスアイコンをクリックするだけです。すべてのレイアウトが表示されるので、必要なものを選択してください。",
  },
  {
    id: 6,
    category: "レイアウト",
    question: "スライドにセクションを追加できますか？",
    answer:
      "もちろんです！テキストボックスやコンテンツブロックの下部にカーソルを合わせると「+」アイコンが表示されます。このボタンをクリックして現在のセクションの下に新しいセクションを追加できます。",
  },

  {
    id: 8,
    category: "エクスポート",
    question: "プレゼンをダウンロードまたはエクスポートするにはどうすればよいですか？",
    answer:
      "右上メニューの「エクスポート」ボタンをクリックしてください。PDF、PowerPointとしてダウンロードを選択できます。",
  },
];

const Help = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredQuestions, setFilteredQuestions] = useState(helpQuestions);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("すべて");
  const modalRef = useRef<HTMLDivElement>(null);

  // Extract unique categories and create "All" category list
  useEffect(() => {
    const uniqueCategories = Array.from(
      new Set(helpQuestions.map((q) => q.category))
    );
    setCategories(["すべて", ...uniqueCategories]);
  }, []);

  // Filter questions based on search query and selected category
  useEffect(() => {
    let results = helpQuestions;

    // Filter by category if not "すべて"
    if (selectedCategory !== "すべて") {
      results = results.filter((q) => q.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        (q) =>
          q.question.toLowerCase().includes(query) ||
          q.answer.toLowerCase().includes(query)
      );
    }

    setFilteredQuestions(results);
  }, [searchQuery, selectedCategory]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target) &&
        !event.target.closest(".help-button")
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleOpenClose = () => {
    setIsOpen(!isOpen);
  };

  // Animation helpers
  const modalClass = isOpen
    ? "opacity-100 scale-100"
    : "opacity-0 scale-95 pointer-events-none";

  return (
    <>
      {/* Help Button */}
      <button
        onClick={handleOpenClose}
        className="help-button hidden fixed bottom-6 right-6 h-12 w-12 z-50 bg-emerald-600 hover:bg-emerald-700 rounded-full md:flex justify-center items-center cursor-pointer shadow-lg transition-all duration-300 hover:shadow-xl"
        aria-label="ヘルプセンター"
      >
        {isOpen ? (
          <X className="text-white h-5 w-5" />
        ) : (
          <HelpCircle className="text-white h-5 w-5" />
        )}
      </button>

      {/* Help Modal */}
      <div
        className={`fixed bottom-20 right-6 z-50 max-w-md w-full transition-all duration-300 transform ${modalClass}`}
        ref={modalRef}
      >
        <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-emerald-600 text-white px-6 py-4 flex justify-between items-center">
            <h2 className="text-lg font-medium">ヘルプセンター</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-emerald-700 p-1 rounded"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <div className="px-6 pt-4 pb-2">
            <div className="relative">
              <input
                type="text"
                placeholder="ヘルプを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>

          {/* Category Pills */}
          <div className="px-6 pb-3 flex gap-2 overflow-x-auto hide-scrollbar">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${selectedCategory === category
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* FAQ Accordion */}
          <div className="max-h-96 overflow-y-auto px-6 pb-6">
            {filteredQuestions.length > 0 ? (
              <Accordion type="single" collapsible className="w-full">
                {filteredQuestions.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`item-${index}`}
                    className="border-b border-gray-200 last:border-b-0"
                  >
                    <AccordionTrigger className="hover:no-underline py-3 px-1 text-left flex">
                      <div className="flex-1 pr-2">
                        <span className="text-gray-900 font-medium text-sm md:text-base">
                          {faq.question}
                        </span>
                        <span className="block text-xs text-emerald-600 mt-0.5">
                          {faq.category}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-1 pb-3">
                      <div className="text-sm text-gray-600 leading-relaxed rounded bg-gray-50 p-3">
                        {faq.answer}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="py-8 text-center text-gray-500">
                <p>「{searchQuery}」の検索結果はありません</p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("すべて");
                  }}
                  className="mt-2 text-emerald-600 hover:underline text-sm"
                >
                  検索をクリア
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-xs text-gray-500 text-center">
            まだお困りですか？{" "}
            <a href="/contact" className="text-emerald-600 hover:underline">
              サポートに問い合わせる
            </a>
          </div>
        </div>
      </div>

      {/* Custom AccordionTrigger implementation (since shadcn's might not be available) */}
      {!AccordionTrigger && (
        <style jsx>{`
          .accordion-trigger {
            display: flex;
            width: 100%;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 0;
            text-align: left;
            transition: all 0.2s;
          }
          .accordion-trigger:hover {
            background-color: rgba(0, 0, 0, 0.02);
          }
          .accordion-content {
            overflow: hidden;
            height: 0;
            transition: height 0.2s ease;
          }
          .accordion-content[data-state="open"] {
            height: auto;
          }
        `}</style>
      )}
    </>
  );
};

export default Help;
