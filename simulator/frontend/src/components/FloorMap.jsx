
import { motion } from 'framer-motion'
import { Server, Activity, Users, Wifi } from 'lucide-react'

const FloorMap = ({ nodes, links }) => {
    const floors = [1, 2, 3]

    // Helper to map node ID to component
    const getNodeIcon = (type) => {
        switch (type) {
            case 'server': return <Server size={24} className="text-blue-400" />
            case 'critical': return <Activity size={24} className="text-red-400" />
            case 'guest': return <Wifi size={24} className="text-green-400" />
            default: return <Users size={24} className="text-purple-400" />
        }
    }

    // Get nodes by floor
    const getNodesByFloor = (f) => nodes.filter(n => n.floor === f)

    // Find server (floor 0/basement)
    const serverNode = nodes.find(n => n.floor === 0)

    return (
        <div className="w-full h-full flex flex-col gap-8 relative">
            {/* Background Grid */}
            <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 opacity-5 pointer-events-none">
                {[...Array(36)].map((_, i) => <div key={i} className="border border-white/20"></div>)}
            </div>

            {/* Render Floors */}
            {floors.reverse().map(floor => (
                <div key={floor} className="relative h-[180px] w-full border-b border-white/5 pl-20">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-4xl font-black text-white/5 rotate-90 origin-left">
                        LEVEL {floor}
                    </span>

                    {/* Floor Plane */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent skew-x-12 origin-bottom-left transform-gpu border-l border-white/10"></div>

                    {/* Nodes */}
                    {getNodesByFloor(floor).map(node => (
                        <motion.div
                            key={node.id}
                            className="absolute flex flex-col items-center gap-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, x: node.pos.x / 1.5, y: node.pos.y / 4 }} // Scale generic pos to fit
                            transition={{ duration: 0.5 }}
                        >
                            <div className="relative group">
                                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                                <div className="bg-gray-900 border border-gray-700 p-3 rounded-xl shadow-xl relative z-10">
                                    {getNodeIcon(node.type)}
                                </div>
                                {/* Label Tooltip */}
                                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-gray-400 font-mono bg-gray-900/80 px-2 py-1 rounded">
                                    {node.label}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            ))}

            {/* Server Room (Basement) */}
            <div className="h-[120px] w-full mt-4 pl-20 relative border-t border-purple-500/20 bg-purple-900/5">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-2xl font-black text-purple-500/20 rotate-90 origin-left">
                    CORE
                </span>
                {serverNode && (
                    <motion.div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    >
                        <div className="bg-purple-900/20 border border-purple-500 p-4 rounded-full shadow-[0_0_50px_rgba(168,85,247,0.2)]">
                            <Server size={32} className="text-purple-400" />
                        </div>
                        <div className="text-center mt-2 text-purple-300 font-bold text-sm">DATA CENTER</div>
                    </motion.div>
                )}
            </div>

            {/* Connection Lines (SVG Overlay) */}
            {/* Note: In a real complex app, we'd calculate exact coordinates. 
           For this demo, we visualized the 'Nodes' nicely. 
           We can iterate to draw lines if time permits. */}
        </div>
    )
}

export default FloorMap
