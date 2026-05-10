import React from 'react'


const OnBoardingHeader = ({ currentStep }: { currentStep: number }) => {
    return (
        <div className='relative z-20 mt-5 mb-8 flex items-center justify-start gap-1 overflow-x-auto pb-2 font-syne sm:justify-end md:mt-7 md:mb-[52px]'>

            <div className='flex items-center gap-1'>
                <div className={`${currentStep === 1 ? 'bg-[#010100] text-white' : 'border border-[#ECECEF] text-[#494A4D]'} px-2.5 h-7 w-7  text-xs font-medium rounded-full flex items-center justify-center`}>
                    1
                </div>
                <p className='whitespace-nowrap text-xs text-[#010000]'>Select Mode</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="1" viewBox="0 0 22 1" fill="none">
                <path d="M0 0.5H21.5" stroke="#ECECEF" />
            </svg>
            <div className='flex items-center gap-1'>
                <div className={`${currentStep === 2 ? 'bg-[#010100] text-white' : 'border border-[#ECECEF] text-[#494A4D]'} px-2.5 h-7 w-7  text-xs font-medium rounded-full flex items-center justify-center`}>
                    2
                </div>
                <p className='whitespace-nowrap text-xs text-[#010000]'>Choose Providers</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="1" viewBox="0 0 22 1" fill="none">
                <path d="M0 0.5H21.5" stroke="#ECECEF" />
            </svg>
            <div className='flex items-center gap-1'>
                <div className={`${currentStep === 3 ? 'bg-[#010100] text-white' : 'border border-[#ECECEF] text-[#494A4D]'} px-2.5 h-7 w-7  text-xs font-medium rounded-full flex items-center justify-center`}>
                    3
                </div>
                <p className='whitespace-nowrap text-xs text-[#010000]'>Finish Setup</p>
            </div>
        </div>
    )
}

export default OnBoardingHeader
