import React from 'react'
import DashboardSidebar from './Components/DashboardSidebar'

const layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className='flex min-h-dvh bg-[#fbf9ff] pb-20 text-slate-950 md:h-screen md:overflow-hidden md:pb-0'>
            <DashboardSidebar />
            <div className='min-w-0 flex-1 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.08),transparent_32%),linear-gradient(180deg,#fbf9ff_0%,#ffffff_48%,#f8fafc_100%)] md:h-screen md:overflow-y-auto'>
                {children}
            </div>
        </div>
    )
}

export default layout
