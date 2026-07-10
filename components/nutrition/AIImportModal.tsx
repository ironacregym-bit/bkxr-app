"use client";

export default function AIImportModal({
  open,
  result,
  onClose,
  onImport,
}: {
  open: boolean;
  result: any;
  onClose: () => void;
  onImport: (result: any) => void;
}) a{
  if (!open || !result) {
    return null;
  }

  return (
    <div className="ia-modal-backdrop">
      <div
        className="ia-modal-card"
        style={{
          maxWidth: 600,
        }}
      >
      <div
        className="d-flex justify-content-end mt-3"
        style={{ gap: 8 }}
      >
        <button
          className="ia-btn ia-btn-outline"
          onClick={onClose}
        >
          Cancel
        </button>
      
        <button
          className="ia-btn ia-btn-primary"
          onClick={() => onImport(result)}
        >
          Import
        </button>
      </div>

        <div className="mb-3">
          <div>
            Calories: {result.calories || 0}
          </div>

          <div>
            Protein: {result.protein || 0}g
          </div>

          <div>
            Carbs: {result.carbs || 0}g
          </div>

          <div>
            Fat: {result.fat || 0}g
          </div>
        </div>

        {Array.isArray(result.foods) &&
          result.foods.length > 0 && (
            <div>
              <div className="ia-kicker mb-2">
                Foods Found
              </div>

              {result.foods.map(
                (food: any, index: number) => (
                  <div
                    key={index}
                    style={{
                      padding: 10,
                      marginBottom: 8,
                      border:
                        "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                    }}
                  >
                    <div>{food.name}</div>

                    <div className="small text-dim">
                      {food.calories || 0} kcal
                    </div>
                  </div>
                )
              )}
            </div>
          )}

        <div className="d-flex justify-content-end mt-3">
          <button
            className="ia-btn ia-btn-primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
