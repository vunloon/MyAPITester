import { Trash2 } from 'lucide-react';

export interface KeyValueItem {
  key: string;
  value: string;
  active: boolean;
}

interface KeyValueEditorProps {
  items: KeyValueItem[];
  onChange: (items: KeyValueItem[]) => void;
  namePlaceholder?: string;
  valuePlaceholder?: string;
}

export function KeyValueEditor({ items, onChange, namePlaceholder = "Key", valuePlaceholder = "Value" }: KeyValueEditorProps) {
  
  const handleItemChange = (index: number, field: keyof KeyValueItem, val: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: val };
    
    // Auto-add new row if the last row is being typed in and it's not empty
    if (index === items.length - 1 && (field === 'key' || field === 'value') && val) {
      newItems.push({ key: '', value: '', active: true });
    }
    
    onChange(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    if (newItems.length === 0) {
       newItems.push({ key: '', value: '', active: true });
    }
    onChange(newItems);
  };

  // Ensure there's always an empty row at the bottom
  const displayItems = items.length > 0 ? items : [{ key: '', value: '', active: true }];
  
  // If the last item isn't empty, append an empty one for the UI
  if (displayItems[displayItems.length - 1].key !== '' || displayItems[displayItems.length - 1].value !== '') {
    displayItems.push({ key: '', value: '', active: true });
  }

  return (
    <div className="flex flex-col w-full h-full overflow-y-auto bg-bg-surface">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border-main text-text-tertiary text-xs uppercase bg-[#252525]">
            <th className="w-10 p-2 font-normal text-center border-r border-border-main"></th>
            <th className="p-2 font-normal border-r border-border-main w-5/12">Key</th>
            <th className="p-2 font-normal border-r border-border-main w-6/12">Value</th>
            <th className="w-10 p-2 font-normal text-center"></th>
          </tr>
        </thead>
        <tbody>
          {displayItems.map((item, idx) => {
            const isLast = idx === displayItems.length - 1;
            const isEmpty = !item.key && !item.value;
            return (
              <tr key={idx} className="border-b border-border-main hover:bg-bg-hover group transition-colors">
                <td className="p-2 text-center align-middle border-r border-border-main">
                  {(!isLast || !isEmpty) ? (
                    <input 
                      type="checkbox" 
                      checked={item.active} 
                      onChange={(e) => handleItemChange(idx, 'active', e.target.checked)}
                      className="accent-orange-500 w-3.5 h-3.5 cursor-pointer rounded"
                    />
                  ) : null}
                </td>
                <td className="p-0 border-r border-border-main">
                  <input 
                    type="text" 
                    value={item.key} 
                    onChange={(e) => handleItemChange(idx, 'key', e.target.value)}
                    placeholder={namePlaceholder}
                    className={`w-full bg-transparent p-2 outline-none text-sm font-mono ${!item.active ? 'text-text-tertiary line-through' : 'text-gray-200'} placeholder-gray-600 focus:bg-bg-hover`}
                  />
                </td>
                <td className="p-0 border-r border-border-main">
                  <input 
                    type="text" 
                    value={item.value} 
                    onChange={(e) => handleItemChange(idx, 'value', e.target.value)}
                    placeholder={valuePlaceholder}
                    className={`w-full bg-transparent p-2 outline-none text-sm font-mono ${!item.active ? 'text-text-tertiary line-through' : 'text-gray-200'} placeholder-gray-600 focus:bg-bg-hover`}
                  />
                </td>
                <td className="p-2 text-center align-middle">
                  {(!isLast || !isEmpty) && (
                    <button 
                      onClick={() => handleRemoveItem(idx)}
                      className="text-text-tertiary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
