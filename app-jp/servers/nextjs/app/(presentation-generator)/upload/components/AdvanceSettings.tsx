import ToolTip from '@/components/ToolTip'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SlidersHorizontal } from 'lucide-react'
import React, { useState } from 'react'
import { PresentationConfig, ToneType, VerbosityType } from '../type'


interface ConfigurationSelectsProps {
    config: PresentationConfig;
    onConfigChange: (key: keyof PresentationConfig, value: any) => void;
}
const AdvanceSettings = ({ config, onConfigChange }: ConfigurationSelectsProps) => {

    const [openAdvanced, setOpenAdvanced] = useState(false);

    const [advancedDraft, setAdvancedDraft] = useState({
        tone: config.tone,
        verbosity: config.verbosity,
        instructions: config.instructions,
        includeTableOfContents: config.includeTableOfContents,
        includeTitleSlide: config.includeTitleSlide,
        webSearch: config.webSearch,
    });

    const handleOpenAdvancedChange = (open: boolean) => {
        if (open) {
            setAdvancedDraft({
                tone: config.tone,
                verbosity: config.verbosity,
                instructions: config.instructions,
                includeTableOfContents: config.includeTableOfContents,
                includeTitleSlide: config.includeTitleSlide,
                webSearch: config.webSearch,
            });
        }
        setOpenAdvanced(open);
    };

    const handleSaveAdvanced = () => {
        onConfigChange("tone", advancedDraft.tone);
        onConfigChange("verbosity", advancedDraft.verbosity);
        onConfigChange("instructions", advancedDraft.instructions);
        onConfigChange("includeTableOfContents", advancedDraft.includeTableOfContents);
        onConfigChange("includeTitleSlide", advancedDraft.includeTitleSlide);
        onConfigChange("webSearch", advancedDraft.webSearch);
        setOpenAdvanced(false);
    };
    return (
        <div className=''>
            <ToolTip content="詳細設定" className='w-full h-full'>
                <button
                    aria-label="詳細設定"
                    title="詳細設定"
                    type="button"
                    onClick={() => handleOpenAdvancedChange(true)}
                    className=" w-full h-full flex items-center px-3 py-1 text-sm  bg-[#F7F6F9] hover:bg-[#F7F6F9] border-[#EDEEEF] focus-visible:ring-[#5141E5] border-none rounded-[48px] font-instrument_sans font-medium"
                >
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
            </ToolTip>
            <Dialog open={openAdvanced} onOpenChange={handleOpenAdvancedChange}>
                <DialogContent className="max-w-2xl font-instrument_sans">
                    <DialogHeader>
                        <DialogTitle>詳細設定</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* Tone */}
                        <div className="w-full flex flex-col gap-2">
                            <label className="text-sm font-semibold text-gray-700">トーン</label>
                            <p className="text-xs text-gray-500">文章スタイルを設定します（例：カジュアル、プロフェッショナル、ユーモラス）。</p>
                            <Select
                                value={advancedDraft.tone}
                                onValueChange={(value) => setAdvancedDraft((prev) => ({ ...prev, tone: value as ToneType }))}
                            >
                                <SelectTrigger className="w-full font-instrument_sans capitalize font-medium bg-blue-100 border-blue-200 focus-visible:ring-blue-300">
                                    <SelectValue placeholder="トーンを選択" />
                                </SelectTrigger>
                                <SelectContent className="font-instrument_sans">
                                    {Object.values(ToneType).map((tone) => (
                                        <SelectItem key={tone} value={tone} className="text-sm font-medium capitalize">
                                            {tone}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Verbosity */}
                        <div className="w-full flex flex-col gap-2">
                            <label className="text-sm font-semibold text-gray-700">詳細度</label>
                            <p className="text-xs text-gray-500">スライドの説明の詳細度を設定します：簡潔、標準、詳細。</p>
                            <Select
                                value={advancedDraft.verbosity}
                                onValueChange={(value) => setAdvancedDraft((prev) => ({ ...prev, verbosity: value as VerbosityType }))}
                            >
                                <SelectTrigger className="w-full font-instrument_sans capitalize font-medium bg-blue-100 border-blue-200 focus-visible:ring-blue-300">
                                    <SelectValue placeholder="詳細度を選択" />
                                </SelectTrigger>
                                <SelectContent className="font-instrument_sans">
                                    {Object.values(VerbosityType).map((verbosity) => (
                                        <SelectItem key={verbosity} value={verbosity} className="text-sm font-medium capitalize">
                                            {verbosity}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>



                        {/* Toggles */}
                        <div className="w-full flex flex-col gap-2 p-3 rounded-md bg-blue-100 border-blue-200">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-gray-700">目次を含める</label>
                                <Switch
                                    checked={advancedDraft.includeTableOfContents}
                                    onCheckedChange={(checked) => setAdvancedDraft((prev) => ({ ...prev, includeTableOfContents: checked }))}
                                />
                            </div>
                            <p className="text-xs text-gray-600">セクションをまとめた目次スライドを追加します（3スライド以上必要）。</p>
                        </div>
                        <div className="w-full flex flex-col gap-2 p-3 rounded-md bg-blue-100 border-blue-200">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-gray-700">タイトルスライド</label>
                                <Switch
                                    checked={advancedDraft.includeTitleSlide}
                                    onCheckedChange={(checked) => setAdvancedDraft((prev) => ({ ...prev, includeTitleSlide: checked }))}
                                />
                            </div>
                            <p className="text-xs text-gray-600">最初のスライドとしてタイトルスライドを追加します。</p>
                        </div>
                        <div className="w-full flex flex-col gap-2 p-3 rounded-md bg-blue-100 border-blue-200">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-gray-700">Web検索</label>
                                <Switch
                                    checked={advancedDraft.webSearch}
                                    onCheckedChange={(checked) => setAdvancedDraft((prev) => ({ ...prev, webSearch: checked }))}
                                />
                            </div>
                            <p className="text-xs text-gray-600">最新の情報をWebから取得できるようにします。</p>
                        </div>

                        {/* Instructions */}
                        <div className="w-full sm:col-span-2 flex flex-col gap-2">
                            <label className="text-sm font-semibold text-gray-700">指示</label>
                            <p className="text-xs text-gray-500">AIへの任意の指示です。形式の制約を除き、デフォルト設定より優先されます。</p>
                            <Textarea
                                value={advancedDraft.instructions}
                                rows={4}
                                onChange={(e) => setAdvancedDraft((prev) => ({ ...prev, instructions: e.target.value }))}
                                placeholder="例：エンタープライズ向けの内容に焦点を当て、ROIとセキュリティコンプライアンスを強調してください。データドリブンなスライドを作成し、専門用語を避け、最後のスライドに簡潔なCTAを含めてください。"
                                className="py-2 px-3 border-2 font-medium text-sm min-h-[100px] max-h-[200px] border-blue-200 focus-visible:ring-offset-0 focus-visible:ring-blue-300"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => handleOpenAdvancedChange(false)}>キャンセル</Button>
                        <Button onClick={handleSaveAdvanced} className="bg-[#5141e5] text-white hover:bg-[#5141e5]/90">保存</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default AdvanceSettings
