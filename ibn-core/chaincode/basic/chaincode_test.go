package main

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-protos-go/ledger/queryresult"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockTransactionContext is a mock for the transaction context
type MockTransactionContext struct {
	contractapi.TransactionContext
	stub *MockStub
}

func (m *MockTransactionContext) GetStub() shim.ChaincodeStubInterface {
	return m.stub
}

// MockStub is a mock for the chaincode stub
type MockStub struct {
	mock.Mock
	shim.ChaincodeStubInterface
}

func (m *MockStub) GetState(key string) ([]byte, error) {
	args := m.Called(key)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]byte), args.Error(1)
}

func (m *MockStub) PutState(key string, value []byte) error {
	args := m.Called(key, value)
	return args.Error(0)
}

func (m *MockStub) DelState(key string) error {
	args := m.Called(key)
	return args.Error(0)
}

func (m *MockStub) SetEvent(name string, payload []byte) error {
	args := m.Called(name, payload)
	return args.Error(0)
}

func (m *MockStub) GetStateByRange(startKey, endKey string) (shim.StateQueryIteratorInterface, error) {
	args := m.Called(startKey, endKey)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(shim.StateQueryIteratorInterface), args.Error(1)
}

// MockIterator is a mock for state query iterator
type MockIterator struct {
	mock.Mock
}

func (m *MockIterator) HasNext() bool {
	args := m.Called()
	return args.Bool(0)
}

func (m *MockIterator) Next() (*queryresult.KV, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*queryresult.KV), args.Error(1)
}

func (m *MockIterator) Close() error {
	args := m.Called()
	return args.Error(0)
}

// Test validation functions
func TestValidateAssetID(t *testing.T) {
	tests := []struct {
		name    string
		id      string
		wantErr bool
	}{
		{"Valid ID", "asset1", false},
		{"Empty ID", "", true},
		{"Too Long ID", string(make([]byte, 65)), true},
		{"Valid Max Length", string(make([]byte, 64)), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateAssetID(tt.id)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateOwner(t *testing.T) {
	tests := []struct {
		name    string
		owner   string
		wantErr bool
	}{
		{"Valid Owner", "John Doe", false},
		{"Empty Owner", "", true},
		{"Too Long Owner", string(make([]byte, 129)), true},
		{"Valid Max Length", string(make([]byte, 128)), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateOwner(tt.owner)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateAssetData(t *testing.T) {
	tests := []struct {
		name           string
		color          string
		size           int
		owner          string
		appraisedValue int
		wantErr        bool
	}{
		{"Valid Data", "blue", 10, "John", 500, false},
		{"Empty Color", "", 10, "John", 500, true},
		{"Negative Size", "blue", -1, "John", 500, true},
		{"Zero Size", "blue", 0, "John", 500, true},
		{"Too Large Size", "blue", 1000001, "John", 500, true},
		{"Empty Owner", "blue", 10, "", 500, true},
		{"Negative Value", "blue", 10, "John", -1, true},
		{"Too Large Value", "blue", 10, "John", 1000000001, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateAssetData(tt.color, tt.size, tt.owner, tt.appraisedValue)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

// Test AssetExists
func TestAssetExists(t *testing.T) {
	stub := new(MockStub)
	ctx := &MockTransactionContext{stub: stub}
	contract := SmartContract{}

	t.Run("Asset Exists", func(t *testing.T) {
		asset := Asset{ID: "asset1", Color: "blue", Size: 5, Owner: "John", AppraisedValue: 300}
		assetJSON, _ := json.Marshal(asset)
		stub.On("GetState", "asset1").Return(assetJSON, nil).Once()

		exists, err := contract.AssetExists(ctx, "asset1")
		assert.NoError(t, err)
		assert.True(t, exists)
		stub.AssertExpectations(t)
	})

	t.Run("Asset Does Not Exist", func(t *testing.T) {
		stub.On("GetState", "asset2").Return(nil, nil).Once()

		exists, err := contract.AssetExists(ctx, "asset2")
		assert.NoError(t, err)
		assert.False(t, exists)
		stub.AssertExpectations(t)
	})
}

// Test CreateAsset
func TestCreateAsset(t *testing.T) {
	stub := new(MockStub)
	ctx := &MockTransactionContext{stub: stub}
	contract := SmartContract{}

	t.Run("Create Asset Successfully", func(t *testing.T) {
		stub.On("GetState", "asset1").Return(nil, nil).Once()
		stub.On("PutState", "asset1", mock.AnythingOfType("[]uint8")).Return(nil).Once()
		stub.On("SetEvent", "AssetCreated", mock.AnythingOfType("[]uint8")).Return(nil).Once()

		err := contract.CreateAsset(ctx, "asset1", "blue", 10, "John", 500)
		assert.NoError(t, err)
		stub.AssertExpectations(t)
	})

	t.Run("Asset Already Exists", func(t *testing.T) {
		asset := Asset{ID: "asset2", Color: "red", Size: 5, Owner: "Jane", AppraisedValue: 400}
		assetJSON, _ := json.Marshal(asset)
		stub.On("GetState", "asset2").Return(assetJSON, nil).Once()

		err := contract.CreateAsset(ctx, "asset2", "blue", 10, "John", 500)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "already exists")
		stub.AssertExpectations(t)
	})

	t.Run("Invalid Asset ID", func(t *testing.T) {
		err := contract.CreateAsset(ctx, "", "blue", 10, "John", 500)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "cannot be empty")
	})

	t.Run("Invalid Asset Data", func(t *testing.T) {
		err := contract.CreateAsset(ctx, "asset3", "", 10, "John", 500)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "color cannot be empty")
	})
}

// Test ReadAsset
func TestReadAsset(t *testing.T) {
	stub := new(MockStub)
	ctx := &MockTransactionContext{stub: stub}
	contract := SmartContract{}

	t.Run("Read Asset Successfully", func(t *testing.T) {
		asset := Asset{
			ID:             "asset1",
			Color:          "blue",
			Size:           10,
			Owner:          "John",
			AppraisedValue: 500,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		}
		assetJSON, _ := json.Marshal(asset)
		stub.On("GetState", "asset1").Return(assetJSON, nil).Once()

		result, err := contract.ReadAsset(ctx, "asset1")
		assert.NoError(t, err)
		assert.Equal(t, "asset1", result.ID)
		assert.Equal(t, "blue", result.Color)
		assert.Equal(t, "John", result.Owner)
		stub.AssertExpectations(t)
	})

	t.Run("Asset Does Not Exist", func(t *testing.T) {
		stub.On("GetState", "asset2").Return(nil, nil).Once()

		result, err := contract.ReadAsset(ctx, "asset2")
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "does not exist")
		stub.AssertExpectations(t)
	})
}

// Test UpdateAsset
func TestUpdateAsset(t *testing.T) {
	stub := new(MockStub)
	ctx := &MockTransactionContext{stub: stub}
	contract := SmartContract{}

	t.Run("Update Asset Successfully", func(t *testing.T) {
		oldAsset := Asset{
			ID:             "asset1",
			Color:          "blue",
			Size:           10,
			Owner:          "John",
			AppraisedValue: 500,
			CreatedAt:      time.Now(),
			CreatedBy:      "creator1",
		}
		assetJSON, _ := json.Marshal(oldAsset)
		stub.On("GetState", "asset1").Return(assetJSON, nil).Once()
		stub.On("PutState", "asset1", mock.AnythingOfType("[]uint8")).Return(nil).Once()
		stub.On("SetEvent", "AssetUpdated", mock.AnythingOfType("[]uint8")).Return(nil).Once()

		err := contract.UpdateAsset(ctx, "asset1", "red", 20, "Jane", 600)
		assert.NoError(t, err)
		stub.AssertExpectations(t)
	})

	t.Run("Asset Does Not Exist", func(t *testing.T) {
		stub.On("GetState", "asset2").Return(nil, nil).Once()

		err := contract.UpdateAsset(ctx, "asset2", "red", 20, "Jane", 600)
		assert.Error(t, err)
		stub.AssertExpectations(t)
	})
}

// Test DeleteAsset
func TestDeleteAsset(t *testing.T) {
	stub := new(MockStub)
	ctx := &MockTransactionContext{stub: stub}
	contract := SmartContract{}

	t.Run("Delete Asset Successfully", func(t *testing.T) {
		asset := Asset{ID: "asset1", Color: "blue", Size: 10, Owner: "John", AppraisedValue: 500}
		assetJSON, _ := json.Marshal(asset)
		stub.On("GetState", "asset1").Return(assetJSON, nil).Once()
		stub.On("DelState", "asset1").Return(nil).Once()
		stub.On("SetEvent", "AssetDeleted", mock.AnythingOfType("[]uint8")).Return(nil).Once()

		err := contract.DeleteAsset(ctx, "asset1")
		assert.NoError(t, err)
		stub.AssertExpectations(t)
	})

	t.Run("Asset Does Not Exist", func(t *testing.T) {
		stub.On("GetState", "asset2").Return(nil, nil).Once()

		err := contract.DeleteAsset(ctx, "asset2")
		assert.Error(t, err)
		stub.AssertExpectations(t)
	})
}

// Test TransferAsset
func TestTransferAsset(t *testing.T) {
	stub := new(MockStub)
	ctx := &MockTransactionContext{stub: stub}
	contract := SmartContract{}

	t.Run("Transfer Asset Successfully", func(t *testing.T) {
		asset := Asset{
			ID:             "asset1",
			Color:          "blue",
			Size:           10,
			Owner:          "John",
			AppraisedValue: 500,
			CreatedAt:      time.Now(),
		}
		assetJSON, _ := json.Marshal(asset)
		stub.On("GetState", "asset1").Return(assetJSON, nil).Once()
		stub.On("PutState", "asset1", mock.AnythingOfType("[]uint8")).Return(nil).Once()
		stub.On("SetEvent", "AssetTransferred", mock.AnythingOfType("[]uint8")).Return(nil).Once()

		err := contract.TransferAsset(ctx, "asset1", "Jane")
		assert.NoError(t, err)
		stub.AssertExpectations(t)
	})

	t.Run("Same Owner", func(t *testing.T) {
		asset := Asset{ID: "asset1", Color: "blue", Size: 10, Owner: "John", AppraisedValue: 500}
		assetJSON, _ := json.Marshal(asset)
		stub.On("GetState", "asset1").Return(assetJSON, nil).Once()

		err := contract.TransferAsset(ctx, "asset1", "John")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "already owned")
		stub.AssertExpectations(t)
	})
}

// Test GetAllAssets
func TestGetAllAssets(t *testing.T) {
	stub := new(MockStub)
	ctx := &MockTransactionContext{stub: stub}
	contract := SmartContract{}

	t.Run("Get All Assets Successfully", func(t *testing.T) {
		asset1 := Asset{ID: "asset1", Color: "blue", Size: 10, Owner: "John", AppraisedValue: 500}
		asset2 := Asset{ID: "asset2", Color: "red", Size: 20, Owner: "Jane", AppraisedValue: 600}
		asset1JSON, _ := json.Marshal(asset1)
		asset2JSON, _ := json.Marshal(asset2)

		iterator := new(MockIterator)
		iterator.On("HasNext").Return(true).Once()
		iterator.On("Next").Return(&queryresult.KV{Key: "asset1", Value: asset1JSON}, nil).Once()
		iterator.On("HasNext").Return(true).Once()
		iterator.On("Next").Return(&queryresult.KV{Key: "asset2", Value: asset2JSON}, nil).Once()
		iterator.On("HasNext").Return(false)
		iterator.On("Close").Return(nil)

		stub.On("GetStateByRange", "", "").Return(iterator, nil).Once()

		assets, err := contract.GetAllAssets(ctx)
		assert.NoError(t, err)
		assert.Len(t, assets, 2)
		assert.Equal(t, "asset1", assets[0].ID)
		assert.Equal(t, "asset2", assets[1].ID)
		stub.AssertExpectations(t)
	})
}

