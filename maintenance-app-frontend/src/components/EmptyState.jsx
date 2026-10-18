export default function EmptyState({ title }) { 
    return  (

    <div className="empty">
        <span>◌</span>
        <h3>No hay {title.toLowerCase()} aún</h3>
        <p>Registra el primer elemento para verlo aquí.</p>
    </div>
    ); 
    
    }
