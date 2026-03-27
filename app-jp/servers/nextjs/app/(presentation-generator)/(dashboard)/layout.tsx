import React from 'react'
import DashboardSidebar from './Components/DashboardSidebar'

const layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className='flex h-screen overflow-hidden bg-slate-50'>
            <DashboardSidebar />
            <div className='flex-1 h-screen overflow-y-auto'>
                {children}
            </div>
        </div>
    )
}

export default layout