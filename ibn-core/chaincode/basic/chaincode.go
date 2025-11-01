package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for managing an Asset
type SmartContract struct {
	contractapi.Contract
}

// Asset describes basic details of what makes up a simple asset
type Asset struct {
	ID             string    `json:"ID"`
	Color          string    `json:"Color"`
	Size           int       `json:"Size"`
	Owner          string    `json:"Owner"`
	AppraisedValue int       `json:"AppraisedValue"`
	CreatedAt      time.Time `json:"CreatedAt"`
	UpdatedAt      time.Time `json:"UpdatedAt"`
	CreatedBy      string    `json:"CreatedBy"`
	UpdatedBy      string    `json:"UpdatedBy"`
}

// AssetHistory represents historical changes to an asset
type AssetHistory struct {
	TxID      string    `json:"TxID"`
	Timestamp time.Time `json:"Timestamp"`
	Asset     Asset     `json:"Asset"`
	IsDelete  bool      `json:"IsDelete"`
}

// InitLedger adds a base set of assets to the ledger
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	log.Println("===== START: InitLedger =====")
	
	// Get client identity for tracking
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		log.Printf("WARNING: Could not get client identity: %v", err)
		clientID = "system"
	}

	now := time.Now()
	assets := []Asset{
		{ID: "asset1", Color: "blue", Size: 5, Owner: "Tomoko", AppraisedValue: 300, CreatedAt: now, UpdatedAt: now, CreatedBy: clientID, UpdatedBy: clientID},
		{ID: "asset2", Color: "red", Size: 5, Owner: "Brad", AppraisedValue: 400, CreatedAt: now, UpdatedAt: now, CreatedBy: clientID, UpdatedBy: clientID},
		{ID: "asset3", Color: "green", Size: 10, Owner: "Jin Soo", AppraisedValue: 500, CreatedAt: now, UpdatedAt: now, CreatedBy: clientID, UpdatedBy: clientID},
		{ID: "asset4", Color: "yellow", Size: 10, Owner: "Max", AppraisedValue: 600, CreatedAt: now, UpdatedAt: now, CreatedBy: clientID, UpdatedBy: clientID},
		{ID: "asset5", Color: "black", Size: 15, Owner: "Adriana", AppraisedValue: 700, CreatedAt: now, UpdatedAt: now, CreatedBy: clientID, UpdatedBy: clientID},
		{ID: "asset6", Color: "white", Size: 15, Owner: "Michel", AppraisedValue: 800, CreatedAt: now, UpdatedAt: now, CreatedBy: clientID, UpdatedBy: clientID},
	}

	for _, asset := range assets {
		assetJSON, err := json.Marshal(asset)
		if err != nil {
			log.Printf("ERROR: Failed to marshal asset %s: %v", asset.ID, err)
			return fmt.Errorf("failed to marshal asset %s: %v", asset.ID, err)
		}

		err = ctx.GetStub().PutState(asset.ID, assetJSON)
		if err != nil {
			log.Printf("ERROR: Failed to put asset %s to world state: %v", asset.ID, err)
			return fmt.Errorf("failed to put asset %s to world state: %v", asset.ID, err)
		}

		// Emit event for asset creation
		eventPayload, _ := json.Marshal(map[string]interface{}{
			"type":   "AssetCreated",
			"assetID": asset.ID,
			"owner":  asset.Owner,
		})
		ctx.GetStub().SetEvent("AssetCreated", eventPayload)
		
		log.Printf("INFO: Initialized asset %s", asset.ID)
	}

	log.Println("===== END: InitLedger =====")
	return nil
}

// CreateAsset issues a new asset to the world state with given details.
func (s *SmartContract) CreateAsset(ctx contractapi.TransactionContextInterface, id string, color string, size int, owner string, appraisedValue int) error {
	log.Printf("===== START: CreateAsset - ID: %s =====", id)

	// Validate inputs
	if err := validateAssetID(id); err != nil {
		log.Printf("ERROR: Invalid asset ID: %v", err)
		return err
	}
	if err := validateAssetData(color, size, owner, appraisedValue); err != nil {
		log.Printf("ERROR: Invalid asset data: %v", err)
		return err
	}

	// Check if asset already exists
	exists, err := s.AssetExists(ctx, id)
	if err != nil {
		log.Printf("ERROR: Failed to check asset existence: %v", err)
		return fmt.Errorf("failed to check asset existence: %v", err)
	}
	if exists {
		log.Printf("ERROR: Asset %s already exists", id)
		return fmt.Errorf("the asset %s already exists", id)
	}

	// Get client identity
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		log.Printf("WARNING: Could not get client identity: %v", err)
		clientID = "unknown"
	}

	now := time.Now()
	asset := Asset{
		ID:             id,
		Color:          color,
		Size:           size,
		Owner:          owner,
		AppraisedValue: appraisedValue,
		CreatedAt:      now,
		UpdatedAt:      now,
		CreatedBy:      clientID,
		UpdatedBy:      clientID,
	}

	assetJSON, err := json.Marshal(asset)
	if err != nil {
		log.Printf("ERROR: Failed to marshal asset: %v", err)
		return fmt.Errorf("failed to marshal asset: %v", err)
	}

	err = ctx.GetStub().PutState(id, assetJSON)
	if err != nil {
		log.Printf("ERROR: Failed to put asset to world state: %v", err)
		return fmt.Errorf("failed to put asset to world state: %v", err)
	}

	// Emit event
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"type":           "AssetCreated",
		"assetID":        id,
		"owner":          owner,
		"appraisedValue": appraisedValue,
		"createdBy":      clientID,
		"timestamp":      now.Unix(),
	})
	err = ctx.GetStub().SetEvent("AssetCreated", eventPayload)
	if err != nil {
		log.Printf("WARNING: Failed to emit event: %v", err)
	}

	log.Printf("INFO: Successfully created asset %s", id)
	log.Printf("===== END: CreateAsset =====")
	return nil
}

// ReadAsset returns the asset stored in the world state with given id.
func (s *SmartContract) ReadAsset(ctx contractapi.TransactionContextInterface, id string) (*Asset, error) {
	assetJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if assetJSON == nil {
		return nil, fmt.Errorf("the asset %s does not exist", id)
	}

	var asset Asset
	err = json.Unmarshal(assetJSON, &asset)
	if err != nil {
		return nil, err
	}

	return &asset, nil
}

// UpdateAsset updates an existing asset in the world state with provided parameters.
func (s *SmartContract) UpdateAsset(ctx contractapi.TransactionContextInterface, id string, color string, size int, owner string, appraisedValue int) error {
	log.Printf("===== START: UpdateAsset - ID: %s =====", id)

	// Validate inputs
	if err := validateAssetID(id); err != nil {
		log.Printf("ERROR: Invalid asset ID: %v", err)
		return err
	}
	if err := validateAssetData(color, size, owner, appraisedValue); err != nil {
		log.Printf("ERROR: Invalid asset data: %v", err)
		return err
	}

	// Check if asset exists
	oldAsset, err := s.ReadAsset(ctx, id)
	if err != nil {
		log.Printf("ERROR: Asset %s does not exist: %v", id, err)
		return err
	}

	// Get client identity
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		log.Printf("WARNING: Could not get client identity: %v", err)
		clientID = "unknown"
	}

	// Create updated asset - preserve creation metadata
	asset := Asset{
		ID:             id,
		Color:          color,
		Size:           size,
		Owner:          owner,
		AppraisedValue: appraisedValue,
		CreatedAt:      oldAsset.CreatedAt,
		UpdatedAt:      time.Now(),
		CreatedBy:      oldAsset.CreatedBy,
		UpdatedBy:      clientID,
	}

	assetJSON, err := json.Marshal(asset)
	if err != nil {
		log.Printf("ERROR: Failed to marshal asset: %v", err)
		return fmt.Errorf("failed to marshal asset: %v", err)
	}

	err = ctx.GetStub().PutState(id, assetJSON)
	if err != nil {
		log.Printf("ERROR: Failed to update asset: %v", err)
		return fmt.Errorf("failed to update asset: %v", err)
	}

	// Emit event
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"type":           "AssetUpdated",
		"assetID":        id,
		"oldOwner":       oldAsset.Owner,
		"newOwner":       owner,
		"oldValue":       oldAsset.AppraisedValue,
		"newValue":       appraisedValue,
		"updatedBy":      clientID,
		"timestamp":      time.Now().Unix(),
	})
	err = ctx.GetStub().SetEvent("AssetUpdated", eventPayload)
	if err != nil {
		log.Printf("WARNING: Failed to emit event: %v", err)
	}

	log.Printf("INFO: Successfully updated asset %s", id)
	log.Printf("===== END: UpdateAsset =====")
	return nil
}

// DeleteAsset deletes a given asset from the world state.
func (s *SmartContract) DeleteAsset(ctx contractapi.TransactionContextInterface, id string) error {
	log.Printf("===== START: DeleteAsset - ID: %s =====", id)

	// Validate input
	if err := validateAssetID(id); err != nil {
		log.Printf("ERROR: Invalid asset ID: %v", err)
		return err
	}

	// Get asset before deletion for event
	asset, err := s.ReadAsset(ctx, id)
	if err != nil {
		log.Printf("ERROR: Asset %s does not exist: %v", id, err)
		return err
	}

	// Get client identity
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		log.Printf("WARNING: Could not get client identity: %v", err)
		clientID = "unknown"
	}

	// Delete asset
	err = ctx.GetStub().DelState(id)
	if err != nil {
		log.Printf("ERROR: Failed to delete asset %s: %v", id, err)
		return fmt.Errorf("failed to delete asset %s: %v", id, err)
	}

	// Emit event
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"type":      "AssetDeleted",
		"assetID":   id,
		"owner":     asset.Owner,
		"deletedBy": clientID,
		"timestamp": time.Now().Unix(),
	})
	err = ctx.GetStub().SetEvent("AssetDeleted", eventPayload)
	if err != nil {
		log.Printf("WARNING: Failed to emit event: %v", err)
	}

	log.Printf("INFO: Successfully deleted asset %s", id)
	log.Printf("===== END: DeleteAsset =====")
	return nil
}

// AssetExists returns true when asset with given ID exists in world state
func (s *SmartContract) AssetExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	assetJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return assetJSON != nil, nil
}

// TransferAsset updates the owner field of asset with given id in world state.
func (s *SmartContract) TransferAsset(ctx contractapi.TransactionContextInterface, id string, newOwner string) error {
	log.Printf("===== START: TransferAsset - ID: %s, New Owner: %s =====", id, newOwner)

	// Validate inputs
	if err := validateAssetID(id); err != nil {
		log.Printf("ERROR: Invalid asset ID: %v", err)
		return err
	}
	if err := validateOwner(newOwner); err != nil {
		log.Printf("ERROR: Invalid new owner: %v", err)
		return err
	}

	// Get existing asset
	asset, err := s.ReadAsset(ctx, id)
	if err != nil {
		log.Printf("ERROR: Failed to read asset %s: %v", id, err)
		return err
	}

	oldOwner := asset.Owner
	
	// Check if already owned by newOwner
	if oldOwner == newOwner {
		log.Printf("ERROR: Asset %s is already owned by %s", id, newOwner)
		return fmt.Errorf("asset %s is already owned by %s", id, newOwner)
	}

	// Get client identity
	clientID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		log.Printf("WARNING: Could not get client identity: %v", err)
		clientID = "unknown"
	}

	// Update asset
	asset.Owner = newOwner
	asset.UpdatedAt = time.Now()
	asset.UpdatedBy = clientID

	assetJSON, err := json.Marshal(asset)
	if err != nil {
		log.Printf("ERROR: Failed to marshal asset: %v", err)
		return fmt.Errorf("failed to marshal asset: %v", err)
	}

	err = ctx.GetStub().PutState(id, assetJSON)
	if err != nil {
		log.Printf("ERROR: Failed to transfer asset: %v", err)
		return fmt.Errorf("failed to transfer asset: %v", err)
	}

	// Emit event
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"type":        "AssetTransferred",
		"assetID":     id,
		"oldOwner":    oldOwner,
		"newOwner":    newOwner,
		"transferredBy": clientID,
		"timestamp":   time.Now().Unix(),
	})
	err = ctx.GetStub().SetEvent("AssetTransferred", eventPayload)
	if err != nil {
		log.Printf("WARNING: Failed to emit event: %v", err)
	}

	log.Printf("INFO: Successfully transferred asset %s from %s to %s", id, oldOwner, newOwner)
	log.Printf("===== END: TransferAsset =====")
	return nil
}

// GetAllAssets returns all assets found in world state
func (s *SmartContract) GetAllAssets(ctx contractapi.TransactionContextInterface) ([]*Asset, error) {
	log.Println("===== START: GetAllAssets =====")

	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		log.Printf("ERROR: Failed to get state by range: %v", err)
		return nil, fmt.Errorf("failed to get state by range: %v", err)
	}
	defer resultsIterator.Close()

	var assets []*Asset
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			log.Printf("ERROR: Failed to iterate results: %v", err)
			return nil, fmt.Errorf("failed to iterate results: %v", err)
		}

		var asset Asset
		err = json.Unmarshal(queryResponse.Value, &asset)
		if err != nil {
			log.Printf("WARNING: Failed to unmarshal asset, skipping: %v", err)
			continue
		}
		assets = append(assets, &asset)
	}

	log.Printf("INFO: Retrieved %d assets", len(assets))
	log.Println("===== END: GetAllAssets =====")
	return assets, nil
}

// GetAssetHistory returns the history of an asset
func (s *SmartContract) GetAssetHistory(ctx contractapi.TransactionContextInterface, id string) ([]AssetHistory, error) {
	log.Printf("===== START: GetAssetHistory - ID: %s =====", id)

	if err := validateAssetID(id); err != nil {
		log.Printf("ERROR: Invalid asset ID: %v", err)
		return nil, err
	}

	resultsIterator, err := ctx.GetStub().GetHistoryForKey(id)
	if err != nil {
		log.Printf("ERROR: Failed to get history for key %s: %v", id, err)
		return nil, fmt.Errorf("failed to get history for key %s: %v", id, err)
	}
	defer resultsIterator.Close()

	var history []AssetHistory
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			log.Printf("ERROR: Failed to iterate history: %v", err)
			return nil, fmt.Errorf("failed to iterate history: %v", err)
		}

		var asset Asset
		if len(response.Value) > 0 {
			err = json.Unmarshal(response.Value, &asset)
			if err != nil {
				log.Printf("WARNING: Failed to unmarshal asset history, skipping: %v", err)
				continue
			}
		}

		historyEntry := AssetHistory{
			TxID:      response.TxId,
			Timestamp: time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)),
			Asset:     asset,
			IsDelete:  response.IsDelete,
		}
		history = append(history, historyEntry)
	}

	log.Printf("INFO: Retrieved %d history entries for asset %s", len(history), id)
	log.Println("===== END: GetAssetHistory =====")
	return history, nil
}

// QueryAssetsByOwner returns all assets owned by a specific owner
func (s *SmartContract) QueryAssetsByOwner(ctx contractapi.TransactionContextInterface, owner string) ([]*Asset, error) {
	log.Printf("===== START: QueryAssetsByOwner - Owner: %s =====", owner)

	if err := validateOwner(owner); err != nil {
		log.Printf("ERROR: Invalid owner: %v", err)
		return nil, err
	}

	queryString := fmt.Sprintf(`{"selector":{"Owner":"%s"}}`, owner)
	
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		log.Printf("ERROR: Failed to execute query: %v", err)
		return nil, fmt.Errorf("failed to execute query: %v", err)
	}
	defer resultsIterator.Close()

	var assets []*Asset
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			log.Printf("ERROR: Failed to iterate query results: %v", err)
			return nil, fmt.Errorf("failed to iterate query results: %v", err)
		}

		var asset Asset
		err = json.Unmarshal(queryResponse.Value, &asset)
		if err != nil {
			log.Printf("WARNING: Failed to unmarshal asset, skipping: %v", err)
			continue
		}
		assets = append(assets, &asset)
	}

	log.Printf("INFO: Found %d assets for owner %s", len(assets), owner)
	log.Println("===== END: QueryAssetsByOwner =====")
	return assets, nil
}

// Validation helper functions
func validateAssetID(id string) error {
	if id == "" {
		return fmt.Errorf("asset ID cannot be empty")
	}
	if len(id) > 64 {
		return fmt.Errorf("asset ID cannot exceed 64 characters")
	}
	return nil
}

func validateOwner(owner string) error {
	if owner == "" {
		return fmt.Errorf("owner cannot be empty")
	}
	if len(owner) > 128 {
		return fmt.Errorf("owner cannot exceed 128 characters")
	}
	return nil
}

func validateAssetData(color string, size int, owner string, appraisedValue int) error {
	if color == "" {
		return fmt.Errorf("color cannot be empty")
	}
	if len(color) > 32 {
		return fmt.Errorf("color cannot exceed 32 characters")
	}
	if size <= 0 {
		return fmt.Errorf("size must be positive")
	}
	if size > 1000000 {
		return fmt.Errorf("size cannot exceed 1000000")
	}
	if err := validateOwner(owner); err != nil {
		return err
	}
	if appraisedValue < 0 {
		return fmt.Errorf("appraised value cannot be negative")
	}
	if appraisedValue > 1000000000 {
		return fmt.Errorf("appraised value cannot exceed 1000000000")
	}
	return nil
}

func main() {
	assetChaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Error creating asset-transfer-basic chaincode: %v", err)
	}

	log.Println("===== Asset Transfer Chaincode Started =====")
	if err := assetChaincode.Start(); err != nil {
		log.Panicf("Error starting asset-transfer-basic chaincode: %v", err)
	}
}
